import {backup,DatabaseSync} from 'node:sqlite';
import {mkdir,copyFile,writeFile,readFile,readdir,rm,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export async function verifyBackup(folder){
 const snapshot=new DatabaseSync(join(folder,'activitytab.sqlite'),{readOnly:true});let documents;
 try{if(snapshot.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Backup database integrity check failed');documents=snapshot.prepare('SELECT id,size FROM documents UNION ALL SELECT file_id AS id,file_size AS size FROM chat_messages WHERE file_id IS NOT NULL').all()}finally{snapshot.close()}
 const manifest=JSON.parse(await readFile(join(folder,'manifest.json'),'utf8'));
 for(const doc of documents){const bytes=await readFile(join(folder,'uploads',doc.id));const entry=manifest.files.find(f=>f.id===doc.id);if(!entry||bytes.length!==Number(doc.size)||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Backup document verification failed')}
 return{documents:documents.length,created:manifest.created};
}
export async function backupData(sqlite,dataDir){
 const root=join(dataDir,'backups'),name='backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8),folder=join(root,'.partial-'+name),completed=join(root,name);
 await mkdir(join(folder,'uploads'),{recursive:true,mode:0o700});
 try{
  await backup(sqlite,join(folder,'activitytab.sqlite'));
  const snapshot=new DatabaseSync(join(folder,'activitytab.sqlite'),{readOnly:true});let documents;
  try{documents=snapshot.prepare('SELECT id,size FROM documents UNION ALL SELECT file_id AS id,file_size AS size FROM chat_messages WHERE file_id IS NOT NULL').all()}finally{snapshot.close()}
  const files=[];for(const doc of documents){if(!/^[\w-]+$/.test(doc.id))throw Error('Invalid document identifier');const target=join(folder,'uploads',doc.id);await copyFile(join(dataDir,'uploads',doc.id),target);const bytes=await readFile(target);files.push({id:doc.id,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})}
  const created=new Date().toISOString();await writeFile(join(folder,'manifest.json'),JSON.stringify({created,files}),{mode:0o600});await verifyBackup(folder);await rename(folder,completed);
  const names=(await readdir(root,{withFileTypes:true})).filter(d=>d.isDirectory()&&/^backup-\d{4}-/.test(d.name)).map(d=>d.name).sort().reverse();for(const old of names.slice(14))await rm(join(root,old),{recursive:true,force:true});
  return{ok:true,name,created,documents:files.length,documentBytes:files.reduce((sum,f)=>sum+f.size,0),retained:Math.min(names.length,14)};
 }catch(error){await rm(folder,{recursive:true,force:true});throw error}
}
