const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(new URL('../app.js',`file://${__filename}`),'utf8');
const start=source.indexOf('function localDateKey');
const end=source.indexOf('function renderProjectList',start);
assert.ok(start>=0&&end>start,'task scheduling helpers must exist');
const context={};vm.createContext(context);
vm.runInContext(source.slice(start,end)+'\nthis.localDateKey=localDateKey;this.isTaskOverdue=isTaskOverdue;this.filterProjectTasks=filterProjectTasks;this.taskStatistics=taskStatistics;this.dueReminderTasks=dueReminderTasks;',context);
test('overdue excludes completed tasks and tasks without due dates',()=>{
 const today='2026-11-12';
 assert.equal(context.isTaskOverdue({dueDate:'2026-11-11',done:false},today),true);
 assert.equal(context.isTaskOverdue({dueDate:'2026-11-11',done:true},today),false);
 assert.equal(context.isTaskOverdue({dueDate:'',done:false},today),false);
 assert.equal(context.isTaskOverdue({dueDate:'2026-11-12',done:false},today),false);
});
test('task filters return the expected task groups',()=>{
 const tasks=[{id:'a',done:false,dueDate:'2026-11-10'},{id:'b',done:true,dueDate:'2026-11-10'},{id:'c',done:false,dueDate:''}];
 assert.deepEqual(JSON.parse(JSON.stringify(context.filterProjectTasks(tasks,'overdue','2026-11-12').map(x=>x.id))),['a']);
 assert.deepEqual(JSON.parse(JSON.stringify(context.filterProjectTasks(tasks,'pending','2026-11-12').map(x=>x.id))),['a','c']);
 assert.deepEqual(JSON.parse(JSON.stringify(context.filterProjectTasks(tasks,'done','2026-11-12').map(x=>x.id))),['b']);
 assert.equal(context.filterProjectTasks(tasks,'all','2026-11-12').length,3);
});
test('task statistics count completion and overdue records',()=>{
 const tasks=[{done:true},{done:false,dueDate:'2026-11-01'},{done:false,dueDate:'2026-11-20'}];
 assert.deepEqual(JSON.parse(JSON.stringify(context.taskStatistics(tasks,'2026-11-12'))),{total:3,done:1,overdue:1});
});

test('local date key uses the device calendar date rather than UTC date',()=>{ const date=new Date(2026,10,12,0,5,0); assert.equal(context.localDateKey(date),'2026-11-12'); });

test('due reminders include only due, pending, not-yet-notified tasks',()=>{
 const projects=[{id:'p',name:'Project',tasks:[
  {id:'a',title:'Due now',reminderAt:'2026-11-12T10:00',done:false,reminderNotifiedAt:0},
  {id:'b',title:'Future',reminderAt:'2026-11-12T12:00',done:false,reminderNotifiedAt:0},
  {id:'c',title:'Completed',reminderAt:'2026-11-12T09:00',done:true,reminderNotifiedAt:0},
  {id:'d',title:'Already notified',reminderAt:'2026-11-12T09:00',done:false,reminderNotifiedAt:1},
  {id:'e',title:'No reminder',reminderAt:'',done:false,reminderNotifiedAt:0}
 ]}];
 const due=context.dueReminderTasks(projects,new Date(2026,10,12,10,30).getTime());
 assert.deepEqual(JSON.parse(JSON.stringify(due.map(x=>x.task.id))),['a']);
});
