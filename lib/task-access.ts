// Task access follows an explicit relationship, never an administrative role.
export function relatedToTask(task:any,member:string){return !!task&&(task.assignee===member||task.creator===member||(!!task.escalated_at&&task.escalation_manager===member))}
export function taskVisibility(alias:string,member:string){return {sql:`(${alias}.assignee=? OR ${alias}.creator=? OR (${alias}.escalated_at IS NOT NULL AND ${alias}.escalation_manager=?))`,args:[member,member,member]}}
// Callers use the fixed notifications alias `n`; arguments contain only member IDs.
export function notificationVisibility(member:string){const task=taskVisibility('vt',member),chat=taskVisibility('ct',member);return {
 sql:`(n.task IS NULL OR EXISTS(SELECT 1 FROM tasks vt WHERE vt.id=n.task AND ${task.sql})) AND (n.conversation IS NULL OR EXISTS(SELECT 1 FROM conversations vc JOIN chat_members vm ON vm.conversation=vc.id WHERE vc.id=n.conversation AND vm.member=? AND (vc.task IS NULL OR EXISTS(SELECT 1 FROM tasks ct WHERE ct.id=vc.task AND ${chat.sql}))))`,
 args:[...task.args,member,...chat.args]
}}
