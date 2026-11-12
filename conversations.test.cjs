'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const app=fs.readFileSync('app.js','utf8');const html=fs.readFileSync('index.html','utf8');
test('chat UI provides separate conversation list and new-chat action',()=>{assert.match(html,/id="conversationList"/);assert.match(html,/id="newConversation"/);});
test('chat state migrates legacy flat messages into one preserved conversation',()=>{assert.match(app,/function migrateConversations\(normalized\)/);assert.match(app,/const legacy=normalized\.messages\.slice\(\)/);assert.match(app,/normalized\.conversations=\[c\]/);});
test('chat messages are stored in active conversation and history is scoped to it',()=>{assert.match(app,/c\.messages\.push\(\{role,text,at:Date\.now\(\)\}\)/);assert.match(app,/history:\(activeConversation\(\)\?\.messages\|\|\[\]\)\.slice\(-12\)/);});
test('chat list supports switching, renaming, deleting and creating conversations',()=>{assert.match(app,/function createConversation\(\)/);assert.match(app,/تغییر نام گفتگو/);assert.match(app,/این گفت‌وگو برای همیشه حذف شود/);assert.match(app,/state\.activeConversationId=c\.id/);});
test('conversation data is included in backup merge',()=>{assert.match(app,/\['memory','projects','messages','conversations','archivedProjects','notifications'\]/);});

test('conversation mutations use rollback-capable state commits',()=>{
 assert.match(app,/function createConversation\(\)[^{]*\{[\s\S]*?commitState\(/);
 assert.match(app,/open\.onclick=\(\)=>\{commitState\(/);
 assert.match(app,/rename\.onclick=\(\)=>\{const name=prompt[\s\S]*?commitState\(/);
 assert.match(app,/del\.onclick=\(\)=>\{if\(!confirm[\s\S]*?commitState\(/);
});
test('legacy flat messages mirror the selected conversation for backward compatibility',()=>{
 assert.match(app,/state\.messages=c\.messages\.slice\(\)/);
 assert.match(app,/state\.messages=\(c\.messages\|\|\[\]\)\.slice\(\)/);
});
