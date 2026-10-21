import assert from 'node:assert/strict';
import {downloadDocument} from '../lib/document-download.ts';
const originals={fetch:globalThis.fetch,document:globalThis.document,create:URL.createObjectURL,revoke:URL.revokeObjectURL,timer:globalThis.setTimeout};
let fetched,downloaded,created,removed=0,revoked=[],timers=[],clickError=false;
globalThis.document={body:{appendChild(){}},createElement(tag){assert.equal(tag,'a');return{click(){if(clickError)throw Error('Download unavailable');downloaded={href:this.href,name:this.download}},remove(){removed++}}}};
URL.createObjectURL=blob=>{created=blob;return 'blob:private-document'};URL.revokeObjectURL=url=>revoked.push(url);globalThis.setTimeout=(fn,ms)=>{timers.push({fn,ms})};
try{
 const bytes=new Uint8Array([0x50,0x4b,3,4,0,255,13,10]);
 globalThis.fetch=async(url,options)=>{fetched={url,options};return new Response(bytes,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}})};
 await downloadDocument('/ActivityTAB/api/documents/test','Sales report.xlsx');
 assert.equal(fetched.options.credentials,'same-origin');assert.equal(fetched.options.cache,'no-store');assert.equal(fetched.url,'/ActivityTAB/api/documents/test');assert.equal(downloaded.href,'blob:private-document');assert.equal(downloaded.name,'Sales report.xlsx');assert.deepEqual(new Uint8Array(await created.arrayBuffer()),bytes);assert.equal(removed,1);assert.equal(revoked.length,0);assert.equal(timers[0].ms,60000);timers[0].fn();assert.deepEqual(revoked,['blob:private-document']);
 downloaded=null;globalThis.fetch=async()=>Response.json({error:'Please sign in to use ActivityTAB.'},{status:401});await assert.rejects(()=>downloadDocument('/ActivityTAB/api/documents/test','Report.xlsx'),/Please sign in/);assert.equal(downloaded,null);
 globalThis.fetch=async()=>new Response('Unavailable',{status:503});await assert.rejects(()=>downloadDocument('/ActivityTAB/api/documents/test','Report.xlsx'),/Unable to download/);assert.equal(downloaded,null);
 globalThis.fetch=async()=>new Response(bytes);clickError=true;await assert.rejects(()=>downloadDocument('/ActivityTAB/api/documents/test','Report.xlsx'),/Download unavailable/);assert.equal(removed,2);assert.equal(revoked.length,2);
 console.log('Document download checks passed: authenticated fetch, exact Excel bytes/filename, delayed cleanup, 401/503 handling, failed-download cleanup.');
}finally{globalThis.fetch=originals.fetch;globalThis.document=originals.document;URL.createObjectURL=originals.create;URL.revokeObjectURL=originals.revoke;globalThis.setTimeout=originals.timer}
