export function nextDue(due:string,frequency:string,anchorDay?:number){const d=new Date(new Date(due).getTime()+330*60000);if(frequency==='daily')d.setUTCDate(d.getUTCDate()+1);else if(frequency==='weekly')d.setUTCDate(d.getUTCDate()+7);else if(frequency==='monthly'){const day=anchorDay||d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last))}else throw Error('Invalid recurrence');return new Date(d.getTime()-330*60000).toISOString()}

export function isWorkingDay(value:string|Date,config:any){
 const local=new Date(new Date(value).getTime()+330*60000),day=local.getUTCDay(),date=local.toISOString().slice(0,10);
 if((config.holidays||[]).some((holiday:any)=>holiday.date===date))return false;
 return !config.weekdaysOnly||(day!==0&&(day!==6||config.includeSaturday===true));
}
export function nextScheduledDue(due:string,frequency:string,anchorDay:number|undefined,config:any){
 let next=nextDue(due,frequency,anchorDay);
 if(frequency==='daily')while(!isWorkingDay(next,config))next=nextDue(next,'daily');
 return next;
}
