'use client';
import {useEffect,useState} from 'react';
type Props={task:any;members:any[];me:any;busy:boolean;defaultHours:number;onAction:(body:any,message:string)=>Promise<boolean>};
export default function TaskEscalation({task,members,me,busy,defaultHours,onAction}:Props){
 const [manager,setManager]=useState(task.escalation_manager||''),[hours,setHours]=useState(String(task.escalation_hours||defaultHours)),[remarks,setRemarks]=useState('');
 useEffect(()=>{setManager(task.escalation_manager||'');setHours(String(task.escalation_hours||defaultHours));setRemarks('')},[task.id,task.escalation_manager,task.escalation_hours,defaultHours]);
 const canConfigure=task.creator===me.id&&['admin','manager'].includes(me.role)&&['pending','progress','returned'].includes(task.status);
 const name=members.find(m=>m.id===task.escalation_manager)?.name||'Selected manager';
 const changed=manager!==(task.escalation_manager||'')||(!!manager&&Number(hours)!==task.escalation_hours);
 const overdue=Date.parse(task.due)<Date.now()&&['pending','progress','returned'].includes(task.status);
 return <section className="drawer-section"><h3>Overdue escalation</h3>
 {task.escalation_manager?<p><strong>{name}</strong> · after {task.escalation_hours} overdue hours.</p>:<p className="small-muted">No additional escalation manager selected.</p>}
 {task.escalated_at&&<p className="info-note compact">Escalated {new Date(task.escalated_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST. The escalation manager can view this task and its documents. The executive remains responsible for completing it.</p>}
 {canConfigure&&<><label>Escalation manager<select aria-label="Escalation manager" value={manager} disabled={busy} onChange={e=>setManager(e.target.value)}><option value="">None</option>{members.filter(m=>m.active&&['admin','manager'].includes(m.role)&&m.id!==task.creator&&m.id!==task.assignee).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
 <label>Escalate after (hours overdue)<input aria-label="Escalate after (hours overdue)" type="number" min="1" max="720" step="1" value={hours} disabled={busy||!manager} onChange={e=>setHours(e.target.value)}/></label>
 <p className="small-muted">Automatic alerts follow working hours and holidays, and repeat using the overdue reminder interval. Access to this task is granted when escalation is sent. Changes here apply to this occurrence; newly generated recurring tasks inherit its saved escalation rule.</p>
 <button className="button" disabled={busy||!changed||!!manager&&(!Number.isInteger(Number(hours))||Number(hours)<1||Number(hours)>720)} onClick={()=>onAction({action:'configureEscalation',escalationManager:manager,escalationHours:Number(hours)},'Escalation rule saved')}>Save escalation rule</button>
 {task.escalation_manager&&overdue&&<><label>Escalation remarks<textarea aria-label="Escalation remarks" rows={3} maxLength={5000} value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Explain the delay and what help is needed…"/></label><button className="button primary" disabled={busy||changed||!remarks.trim()} onClick={async()=>{if(await onAction({action:'escalate',note:remarks},'Escalation notification queued for the selected manager'))setRemarks('')}}>Escalate now</button><p className="small-muted">Sends immediately, including outside working hours. Save any changed rule first. Notifications require the manager to enable mobile alerts.</p></>}
 </>}
 </section>
}
