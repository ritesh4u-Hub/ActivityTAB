import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export function migrate(db,root){
 db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied TEXT NOT NULL)');
 for(const [version,file] of [[2,'professional.sql'],[3,'chat.sql']]){
 if(!db.prepare('SELECT version FROM schema_migrations WHERE version=?').get(version)){
  db.exec('BEGIN IMMEDIATE');
  try{db.exec(readFileSync(join(root,file),'utf8'));db.prepare('INSERT INTO schema_migrations VALUES(?,?)').run(version,new Date().toISOString());db.exec('COMMIT')}
  catch(error){db.exec('ROLLBACK');throw error}
 }
 }
}
