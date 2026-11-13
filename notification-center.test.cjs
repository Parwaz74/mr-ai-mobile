const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(new URL('./app.js',`file://${__filename}`),'utf8');
const start=source.indexOf('function createReminderNotification');
const end=source.indexOf('function renderNotifications',start);
assert.ok(start>=0&&end>start,'notification helpers must exist');
const context={makeStableId:(p)=>`${p}-test-1`};vm.createContext(context);
vm.runInContext(source.slice(start,end)+'\nthis.createReminderNotification=createReminderNotification;this.notificationMatches=notificationMatches;',context);
test('creates a stable-shape reminder notification with task priority and unread state',()=>{
 const item=context.createReminderNotification({id:'p1',name:'AquaSmart'},{id:'t1',title:'Check water quality',priority:'high',reminderAt:'2026-11-12T09:00'},1234);
 assert.equal(item.id,'notice-test-1');assert.equal(item.projectId,'p1');assert.equal(item.taskId,'t1');assert.equal(item.priority,'high');assert.equal(item.readAt,0);assert.equal(item.createdAt,1234);
});
test('defaults invalid notification priority to medium',()=>{
 assert.equal(context.createReminderNotification({}, {priority:'urgent'}).priority,'medium');
});
test('notification filters support all, unread and priority',()=>{
 const unread={readAt:0,priority:'high'},read={readAt:55,priority:'low'};
 assert.equal(context.notificationMatches(unread,'all','all'),true);
 assert.equal(context.notificationMatches(read,'unread','all'),false);
 assert.equal(context.notificationMatches(unread,'unread','high'),true);
 assert.equal(context.notificationMatches(unread,'all','low'),false);
});
