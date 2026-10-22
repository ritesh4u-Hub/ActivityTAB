export function reminderIsRelevant(notification:string,task:any,at=Date.now()){
 if(!/^(before|late|escalation|review):/.test(notification))return true;
 if(!task)return false;
 if(notification.startsWith('review:'))return task.status==='submitted'&&notification.startsWith('review:'+task.id+':'+task.submitted+':');
 if(!['pending','progress','returned'].includes(task.status))return false;
 if(!notification.includes(':'+task.due+':')&&!notification.endsWith(':'+task.due))return false;
 return notification.startsWith('before:')?Date.parse(task.due)>at:Date.parse(task.due)<=at;
}
export function retryDelay(attempt:number,retryAfter?:string|null,at=Date.now()){
 const provider=retryAfter?(/^\d+$/.test(retryAfter)?Number(retryAfter)*1000:Date.parse(retryAfter)-at):0;
 return Math.max(Math.min(Math.max(provider||0,0),86400000),Math.min(30000*2**Math.max(0,attempt-1),1800000))+Math.floor(Math.random()*5000);
}
