export type Holiday={date:string,name:string};
const DAY=86400000;
function day(value:string){const timestamp=Date.parse(value+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==value)throw Error('Enter valid From date and To date values.');return timestamp}
export function addHolidayRange(existing:Holiday[],from:string,to:string,name:string):Holiday[]{
 const start=day(from),end=day(to),label=name.trim();if(end<start)throw Error('To date must be on or after From date.');if(!label||label.length>100)throw Error('Enter a holiday name of up to 100 characters.');
 const count=Math.round((end-start)/DAY)+1;if(existing.length+count>100)throw Error('The calendar supports up to 100 holiday dates. Choose a shorter range or remove existing dates.');
 const used=new Set(existing.map(h=>h.date));const added:Holiday[]=[];
 for(let date=start;date<=end;date+=DAY){const key=new Date(date).toISOString().slice(0,10);if(used.has(key))throw Error('A holiday already exists on '+key+'. Choose a range without overlapping dates.');added.push({date:key,name:label})}
 return [...existing,...added].sort((a,b)=>a.date.localeCompare(b.date));
}
export function holidayRanges(holidays:Holiday[]){
 const groups:{from:string,to:string,name:string}[]=[];
 for(const h of [...holidays].sort((a,b)=>a.date.localeCompare(b.date))){const last=groups.at(-1);if(last&&last.name===h.name&&day(h.date)-day(last.to)===DAY)last.to=h.date;else groups.push({from:h.date,to:h.date,name:h.name})}
 return groups;
}
