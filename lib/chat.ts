import {env} from 'cloudflare:workers';
import {db,id,now,rows,one,flushPush} from './service';
function fail(message:string,status=400):never{throw Object.assign(Error(message),{status})}
const statement=(sql:string,...args:any[])=>db().prepare(sql).bind(...args);
const batch=(statements:any[])=>db().batch(statements);
export async function chatRoute(req:Request,path:string,me:any,taskAccess:(id:string)=>Promise<any>){
 const method=req.method,url=new URL(req.url),parts=path.split('/');
 const access=async(cid:string)=>{const c=await one('SELECT c.* FROM conversations c JOIN chat_members cm ON cm.conversation=c.id WHERE c.id=? AND cm.member=?',cid,me.id);if(!c)fail('Conversation not found',404);if(c.task)await taskAccess(c.task);return c};
 if(path==='chat'&&method==='GET')return Response.json(await rows(`SELECT c.*,cm.muted,cm.last_read_seq,(SELECT COUNT(*) FROM chat_messages m WHERE m.conversation=c.id AND m.sender<>? AND m.seq>cm.last_read_seq) AS unread,(SELECT m.body FROM chat_messages m WHERE m.conversation=c.id ORDER BY seq DESC LIMIT 1) AS preview FROM conversations c JOIN chat_members cm ON cm.conversation=c.id WHERE cm.member=? AND (c.task IS NULL OR EXISTS(SELECT 1 FROM tasks t WHERE t.id=c.task AND (t.assignee=? OR ?=1))) ORDER BY c.updated DESC,c.id LIMIT 200`,me.id,me.id,me.id,['admin','manager'].includes(me.role)?1:0));
 if(path==='chat'&&method==='POST'){
  const b:any=await req.json();let cid=id(),kind=String(b.kind),title='',task=null,direct=null,people:string[]=[];
  if(kind==='task'){const t=await taskAccess(String(b.task));cid='task-'+t.id;task=t.id;title=t.title;people=[me.id,t.assignee,t.creator]}
  else if(kind==='direct'){const target=String(b.member);if(target===me.id)fail('Choose another employee');people=[me.id,target];direct=people.slice().sort().join(':');cid='direct-'+direct}
  else if(kind==='group'){title=String(b.title||'').trim();if(!title||title.length>100)fail('Enter a group name of up to 100 characters');if(!Array.isArray(b.members)||b.members.length<1||b.members.length>99)fail('Choose 1 to 99 other employees');people=[me.id,...b.members.map(String)]}
  else fail('Invalid conversation type');
  people=[...new Set(people)];const activePeople=[];for(const member of people){if(await one('SELECT id FROM members WHERE id=? AND active=1',member))activePeople.push(member);else if(kind!=='task')fail('Choose active employees')}people=activePeople;
  const stamp=now();await batch([statement('INSERT OR IGNORE INTO conversations(id,kind,title,task,direct_key,owner,created,updated) VALUES(?,?,?,?,?,?,?,?)',cid,kind,title,task,direct,me.id,stamp,stamp),...people.map(member=>statement('INSERT OR IGNORE INTO chat_members(conversation,member) VALUES(?,?)',cid,member))]);
  return Response.json({id:cid});
 }
 if(parts[1]==='files'&&parts[2]&&method==='GET'){
  const m=await one('SELECT * FROM chat_messages WHERE file_id=?',parts[2]);if(!m)fail('Attachment not found',404);await access(m.conversation);const f=await env.BUCKET?.get(m.file_id);if(!f)fail('Attachment not found',404);
  return new Response(f.body,{headers:{'Content-Type':m.file_type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(m.file_name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }
 const cid=decodeURIComponent(parts[1]||'');const conversation=await access(cid);
 if(parts[2]==='messages'&&method==='GET'){
  const after=Number(url.searchParams.get('after')||0),before=Number(url.searchParams.get('before')||0);if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(before)||before<0)fail('Invalid message cursor');
  const messages=after?await rows('SELECT * FROM chat_messages WHERE conversation=? AND seq>? ORDER BY seq LIMIT 50',cid,after):await rows('SELECT * FROM chat_messages WHERE conversation=? AND (?=0 OR seq<?) ORDER BY seq DESC LIMIT 50',cid,before,before);
  if(!after)messages.reverse();return Response.json({conversation,messages,members:await rows('SELECT m.id,m.name,m.active,cm.last_read_seq FROM chat_members cm JOIN members m ON m.id=cm.member WHERE cm.conversation=? ORDER BY m.name',cid),hasMore:messages.length===50});
 }
 if(parts[2]==='read'&&method==='POST'){
  const b:any=await req.json(),seq=Number(b.seq);if(!Number.isSafeInteger(seq)||seq<0)fail('Invalid read position');const latest=await one('SELECT MAX(seq) n FROM chat_messages WHERE conversation=?',cid);const through=Math.min(seq,latest?.n||0);
  await batch([statement('UPDATE chat_members SET last_read_seq=MAX(last_read_seq,?) WHERE conversation=? AND member=?',through,cid,me.id),statement("UPDATE notifications SET read=1,read_at=? WHERE recipient=? AND conversation=? AND id IN (SELECT 'chat:'||id||':'||? FROM chat_messages WHERE conversation=? AND seq<=?)",now(),me.id,cid,me.id,cid,through),statement("UPDATE deliveries SET status='superseded',error='Conversation already read' WHERE status='pending' AND notification IN (SELECT id FROM notifications WHERE recipient=? AND conversation=? AND read=1)",me.id,cid)]);return Response.json({ok:true});
 }
 if(parts[2]==='preferences'&&method==='POST'){const b:any=await req.json();if(typeof b.muted!=='boolean')fail('Invalid mute preference');await batch([statement('UPDATE chat_members SET muted=? WHERE conversation=? AND member=?',b.muted?1:0,cid,me.id),...(b.muted?[statement("UPDATE deliveries SET status='superseded',error='Conversation muted' WHERE status='pending' AND notification IN (SELECT id FROM notifications WHERE recipient=? AND conversation=?)",me.id,cid)]:[])]);return Response.json({ok:true})}
 if(parts[2]==='messages'&&method==='POST'){
  const form=await req.formData(),body=String(form.get('body')||'').trim(),client=String(form.get('clientId')||''),file=form.get('file') as File|null;
  if(!/^[a-f0-9-]{36}$/i.test(client))fail('Invalid message identifier');if(body.length>5000||(!body&&!file?.size))fail('Enter a message of up to 5,000 characters or attach a file');
  const existing=await one('SELECT id FROM chat_messages WHERE conversation=? AND sender=? AND client_id=?',cid,me.id,client);if(existing)return Response.json({ok:true,id:existing.id});
  // A short per-sender throttle protects the shared server from message floods.
  if((await one('SELECT COUNT(*) n FROM chat_messages WHERE sender=? AND created>?',me.id,new Date(Date.now()-60000).toISOString())).n>=30)fail('Please wait a minute before sending more messages',429);
  let fid=null,name=null,type=null,size=null;const types:Record<string,string>={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xls:'application/vnd.ms-excel',csv:'text/csv'};
  if(file?.size){if(file.size>10*1024*1024)fail('Chat attachments must be 10 MB or smaller',413);const ext=file.name.split('.').pop()?.toLowerCase();if(!ext||!types[ext])fail('Supported attachments: PDF, JPEG, PNG, Excel and CSV');fid=id();name=file.name.slice(0,200);type=types[ext];size=file.size;if(!env.BUCKET)fail('Attachment storage is unavailable',503);await env.BUCKET.put(fid,await file.arrayBuffer(),{httpMetadata:{contentType:type}})}
  const mid=id(),stamp=now(),recipients=await rows('SELECT cm.member FROM chat_members cm JOIN members m ON m.id=cm.member WHERE cm.conversation=? AND cm.member<>? AND m.active=1 AND (? IS NULL OR EXISTS(SELECT 1 FROM tasks t WHERE t.id=? AND (t.assignee=m.id OR m.role IN (\'admin\',\'manager\'))))',cid,me.id,conversation.task,conversation.task);
  const statements=[statement('INSERT OR IGNORE INTO chat_messages(id,conversation,sender,client_id,body,file_id,file_name,file_type,file_size,created) VALUES(?,?,?,?,?,?,?,?,?,?)',mid,cid,me.id,client,body,fid,name,type,size,stamp),statement('UPDATE conversations SET updated=? WHERE id=? AND EXISTS(SELECT 1 FROM chat_messages WHERE id=?)',stamp,cid,mid)];
  for(const {member} of recipients){const nid='chat:'+mid+':'+member;statements.push(statement('INSERT INTO notifications(id,recipient,task,title,body,created,conversation) SELECT ?,?,NULL,?,?,?,? WHERE EXISTS(SELECT 1 FROM chat_messages WHERE id=?)',nid,member,conversation.kind==='direct'?'Message from '+me.name:me.name+' · '+conversation.title,'New '+(file?.size?'attachment':'message')+' in ActivityTAB. Tap to open the conversation.',stamp,cid,mid),statement("INSERT OR IGNORE INTO deliveries(id,subscription,notification,status,created) SELECT ?||':'||s.id,s.id,?,'pending',? FROM subscriptions s JOIN chat_members cm ON cm.member=s.recipient AND cm.conversation=? WHERE s.recipient=? AND cm.muted=0 AND EXISTS(SELECT 1 FROM notifications WHERE id=?)",nid,nid,stamp,cid,member,nid))}
  try{await batch(statements)}catch(error){if(fid)await env.BUCKET?.delete(fid).catch(()=>{});throw error}
  const committed=await one('SELECT id,file_id FROM chat_messages WHERE conversation=? AND sender=? AND client_id=?',cid,me.id,client);if(fid&&committed.file_id!==fid)await env.BUCKET?.delete(fid).catch(()=>{});void flushPush().catch(()=>{});return Response.json({ok:true,id:committed.id});
 }
 return Response.json({error:'Not found'},{status:404});
}
