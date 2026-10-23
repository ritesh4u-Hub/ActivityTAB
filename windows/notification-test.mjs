import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,realpathSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {migrate} from './src/migrate.mjs';
import {reminderIsRelevant,retryDelay} from '../lib/notification-policy.ts';
const root=resolve(new URL('..',import.meta.url).pathname),dir=mkdtempSync(join(tmpdir(),'activitytab-push-')),db=new DatabaseSync(':memory:');
db.exec(readFileSync(join(root,'windows/dist/schema.sql'),'utf8'));db.exec('ALTER TABLE deliveries ADD updated TEXT');migrate(db,join(root,'windows/dist'));
globalThis.__testEnv={DB:{prepare(sql){return{bind(...args){return{async all(){return{results:db.prepare(sql).all(...args)}},async first(){return db.prepare(sql).get(...args)||null},async run(){return{meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}}}}}};
globalThis.__pushTest={calls:[],active:0,max:0,result:{ok:true,status:201},error:null};
const require=createRequire(realpathSync(join(root,'node_modules/wrangler/package.json'))),esbuild=require('esbuild');
await esbuild.build({entryPoints:[join(root,'lib/service.ts')],bundle:true,platform:'node',format:'esm',outfile:join(dir,'service.mjs'),plugins:[{name:'isolated-push',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fixture'}));b.onResolve({filter:/^\.\/push$/},()=>({path:'push',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='env'?'export const env=globalThis.__testEnv;':`export async function generateVapid(){return {publicKey:'test'}};export async function sendPush(sub,payload){const t=globalThis.__pushTest;t.active++;t.max=Math.max(t.max,t.active);t.calls.push({sub,payload});try{await new Promise(r=>setTimeout(r,5));if(t.error)throw Error(t.error);return t.result}finally{t.active--}}`,loader:'js'}))}}]});
try{
 const service=await import(pathToFileURL(join(dir,'service.mjs')).href),q=(s,...a)=>db.prepare(s).get(...a),run=(s,...a)=>db.prepare(s).run(...a),now=()=>new Date().toISOString(),t=globalThis.__pushTest;
 for(const id of ['a','b'])run('INSERT INTO members(id,email,name,role,department) VALUES(?,?,?,?,?)',id,id+'@test.invalid',id,'executive','Test');
 for(const [id,member] of [['a1','a'],['a2','a'],['b1','b']])run('INSERT INTO subscriptions(id,recipient,data,created) VALUES(?,?,?,?)',id,member,JSON.stringify({endpoint:id}),now());
 await service.notify('a',null,'Test current device','Only a1',undefined,'a1');assert.equal(q('SELECT COUNT(*) n FROM deliveries').n,1);await service.flushPush();assert.equal(t.calls.length,1);assert.equal(t.calls[0].sub.endpoint,'a1');assert.equal(t.calls[0].payload.unreadCount,1);
 const oldCalls=t.calls.length;await service.notify('a',null,'Account A alert','Private','switch','a1');run("UPDATE subscriptions SET recipient='b' WHERE id='a1'");await service.flushPush();assert.equal(t.calls.length,oldCalls);assert.equal(q("SELECT status FROM deliveries WHERE notification='switch'").status,'superseded');
 run("INSERT INTO tasks(id,title,description,assignee,creator,due,priority,status,frequency,required,approval,created) VALUES('task','Report','','a','b',?,'high','pending','once',0,1,?)",new Date(Date.now()-3600000).toISOString(),now());
 let task=q("SELECT * FROM tasks WHERE id='task'");const late='late:task:'+task.due+':0';await service.notify('a','task','Overdue','Please submit',late,'a2');run("UPDATE tasks SET status='completed' WHERE id='task'");await service.flushPush();assert.equal(t.calls.length,oldCalls);assert.equal(q('SELECT status FROM deliveries WHERE notification=?',late).status,'superseded');
 assert.equal(reminderIsRelevant(late,{...task,due:new Date(Date.now()+3600000).toISOString()}),false);assert.equal(reminderIsRelevant('review:task:old:1',{...task,status:'submitted',submitted:'new'}),false);
 t.result={ok:false,status:429,retryAfter:'60'};await service.notify('a',null,'Rate limited','Retry','retry','a2');await service.flushPush();let delivery=q("SELECT * FROM deliveries WHERE notification='retry'");assert.equal(delivery.status,'pending');assert.ok(Date.parse(delivery.next_attempt)-Date.now()>=55000);const attempts=t.calls.length;await service.flushPush();assert.equal(t.calls.length,attempts);run("UPDATE deliveries SET next_attempt=NULL WHERE notification='retry'");t.result={ok:true,status:201};await service.flushPush();assert.equal(q("SELECT status FROM deliveries WHERE notification='retry'").status,'sent');
 t.result={ok:false,status:403};await service.notify('a',null,'Configuration failed','Do not retry','permanent','a2');await service.flushPush();assert.equal(q("SELECT status FROM deliveries WHERE notification='permanent'").status,'failed');
 t.result={ok:true,status:201};t.max=0;for(let i=0;i<12;i++)await service.notify('a',null,'Batch '+i,'Concurrent bounded',undefined,'a2');await service.flushPush();assert.ok(t.max>1&&t.max<=4);
 await service.saveSetting('reminders',{...service.defaults,repeatHours:1,weekdaysOnly:false,workStart:0,workEnd:24});const first=new Date(Date.now()-7200000).toISOString();run("UPDATE tasks SET status='submitted',submitted=? WHERE id='task'",first);await service.maintenance({flush:false});assert.equal(q("SELECT COUNT(*) n FROM notifications WHERE id LIKE 'review:task:%'").n,1);run("UPDATE tasks SET submitted=? WHERE id='task'",new Date(Date.now()-7300000).toISOString());await service.maintenance({flush:false});assert.equal(q("SELECT COUNT(*) n FROM notifications WHERE id LIKE 'review:task:%'").n,2);
 // Chat deep links, mute and read suppression use the same reliable outbox.
 run("INSERT INTO conversations(id,kind,title,owner,created,updated) VALUES('chat-test','group','Team','b',?,?)",now(),now());run("INSERT INTO chat_members(conversation,member) VALUES('chat-test','a')");
 const enqueue=async nid=>{await service.notify('a',null,'Chat update','Tap to open',nid,'a2');run("UPDATE notifications SET conversation='chat-test' WHERE id=?",nid)};
 await enqueue('chat-link');await service.flushPush();assert.equal(t.calls.at(-1).payload.url,'/?chat=chat-test');
 await enqueue('chat-muted');run("UPDATE chat_members SET muted=1 WHERE conversation='chat-test'");const chatCalls=t.calls.length;await service.flushPush();assert.equal(t.calls.length,chatCalls);assert.equal(q("SELECT status FROM deliveries WHERE notification='chat-muted'").status,'superseded');
 run("UPDATE chat_members SET muted=0 WHERE conversation='chat-test'");await enqueue('chat-read');run("UPDATE notifications SET read=1 WHERE id='chat-read'");await service.flushPush();assert.equal(t.calls.length,chatCalls);assert.equal(q("SELECT status FROM deliveries WHERE notification='chat-read'").status,'superseded');
 // Administrative role does not override task relationship on notification creation or delivery.
 run("INSERT INTO members(id,email,name,role,department) VALUES('c','c@test.invalid','Unrelated admin','admin','Test')");run("INSERT INTO subscriptions(id,recipient,data,created) VALUES('c1','c',?,?)",JSON.stringify({endpoint:'c1'}),now());
 await service.notify('c','task','Private task','Must not leak','denied-task','c1');assert.equal(q("SELECT id FROM notifications WHERE id='denied-task'"),undefined);
 run("INSERT INTO notifications(id,recipient,task,title,body,created) VALUES('legacy-leak','c','task','Private','Hidden',?)",now());run("INSERT INTO deliveries(id,subscription,notification,status,created) VALUES('legacy-delivery','c1','legacy-leak','pending',?)",now());const privacyCalls=t.calls.length;await service.flushPush();assert.equal(t.calls.length,privacyCalls);assert.equal(q("SELECT status FROM deliveries WHERE id='legacy-delivery'").status,'superseded');
 // Automatic escalation uses the same outbox, stops at submission and resets for recurrence.
 run("UPDATE tasks SET status='pending',frequency='daily',next_created=0,escalation_manager='c',escalation_hours=1,escalated_at=NULL WHERE id='task'");
 await service.maintenance({flush:false});assert.ok(q("SELECT escalated_at FROM tasks WHERE id='task'").escalated_at);
 const escalation=q("SELECT * FROM notifications WHERE recipient='c' AND title LIKE 'Overdue escalation:%'");assert.ok(escalation);assert.ok(q('SELECT id FROM deliveries WHERE notification=?',escalation.id));
 await service.flushPush();const escalationPush=t.calls.find(c=>c.payload.tag===escalation.id);assert.equal(escalationPush.payload.url,'/?task=task');assert.equal(escalationPush.sub.endpoint,'c1');
 const generated=q("SELECT * FROM tasks WHERE parent='task'");assert.equal(generated.escalation_manager,'c');assert.equal(generated.escalation_hours,1);assert.equal(generated.escalated_at,null);
 const count=q("SELECT COUNT(*) n FROM notifications WHERE title LIKE 'Overdue escalation:%'").n;await service.maintenance({flush:false});assert.equal(q("SELECT COUNT(*) n FROM notifications WHERE title LIKE 'Overdue escalation:%'").n,count);
 run("UPDATE tasks SET escalated_at=NULL,status='submitted' WHERE id='task'");await service.maintenance({flush:false});assert.equal(q("SELECT COUNT(*) n FROM notifications WHERE title LIKE 'Overdue escalation:%'").n,count);
 // An escalation queued just before completion must be superseded at delivery time.
 run("UPDATE tasks SET status='pending',escalated_at=NULL WHERE id='task'");await service.escalateTask(q("SELECT * FROM tasks WHERE id='task'"),'Test assigner','Please resolve',true);
 const queued=q("SELECT id FROM notifications WHERE body='Please resolve'");run("UPDATE tasks SET status='completed' WHERE id='task'");await service.flushPush();assert.equal(q('SELECT status FROM deliveries WHERE notification=?',queued.id).status,'superseded');
 assert.ok(retryDelay(1,'120')>=120000);console.log('PASS: isolated notification tests cover current-device targeting, account separation, stale reminders, review cycles, bounded concurrency, Retry-After/backoff, permanent failures and chat deep links/read/mute suppression. No external push requests made.');
}finally{db.close();delete globalThis.__testEnv;delete globalThis.__pushTest;rmSync(dir,{recursive:true,force:true})}
