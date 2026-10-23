import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const listeners={},displayed=[];
vm.runInNewContext(readFileSync(new URL('../windows/dist/public/sw.js',import.meta.url),'utf8'),{self:{addEventListener:(type,handler)=>listeners[type]=handler,registration:{showNotification:async(title,options)=>displayed.push({title,options})}},navigator:{},URL,Promise,Number});
let ready;listeners.push({data:{json:()=>({title:'Task update',body:'Please review',url:'/ActivityTAB/?task=sample',tag:'notice-1',unreadCount:1})},waitUntil:p=>ready=p});await ready;
assert.equal(displayed.length,1);assert.equal(displayed[0].options.silent,false);assert.deepEqual(Array.from(displayed[0].options.vibrate),[200,100,200]);assert.equal(displayed[0].options.data.url,'/ActivityTAB/?task=sample');assert.equal(displayed[0].options.icon,'/ActivityTAB/icon-192.png');
console.log('PASS: worker requests audible notification and vibration, preserves scoped task link, and displays without badge API. Actual tone remains controlled by device settings.');
