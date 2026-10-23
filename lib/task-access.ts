// Task access follows the relationship, never the user's administrative role.
export function relatedToTask(task:any,member:string){return !!task&&(task.assignee===member||task.creator===member)}
// Callers use the fixed notifications alias `n`; arguments contain only member IDs.
export function notificationVisibility(member:string){return {
 sql:`(n.task IS NULL OR EXISTS(SELECT 1 FROM tasks vt WHERE vt.id=n.task AND (vt.assignee=? OR vt.creator=?))) AND (n.conversation IS NULL OR EXISTS(SELECT 1 FROM conversations vc JOIN chat_members vm ON vm.conversation=vc.id WHERE vc.id=n.conversation AND vm.member=? AND (vc.task IS NULL OR EXISTS(SELECT 1 FROM tasks ct WHERE ct.id=vc.task AND (ct.assignee=? OR ct.creator=?)))))`,
 args:[member,member,member,member,member]
}}
