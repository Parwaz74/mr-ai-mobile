const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(new URL('../app.js', `file://${__filename}`), 'utf8');
const start = source.indexOf("const KEY='mr_ai_v06_store'");
const end = source.indexOf('let state=readState()', start);
assert.ok(start >= 0 && end > start, 'storage core section must exist');
const core = source.slice(start, end);
function loadStore(seed) {
  const data = new Map(Object.entries(seed || {}));
  const context = { localStorage: { getItem:k=>data.has(k)?data.get(k):null, setItem:(k,v)=>data.set(k,v), removeItem:k=>data.delete(k) }, console };
  vm.createContext(context); vm.runInContext(core + '\nthis.readState=readState; this.normalizeState=normalizeState;', context);
  return { context, data };
}
test('merges v0.6 and legacy v0.5 records without losing metadata', () => {
  const a = {schemaVersion:7, customFlag:'keep-me', memory:[{title:'new',body:'A'}], projects:[{name:'P'}]};
  const b = {memory:[{title:'old',body:'B'}], messages:[{role:'user',text:'hello'}], archivedProjects:[]};
  const {context} = loadStore({mr_ai_v06_store:JSON.stringify(a),mr_ai_v05_store:JSON.stringify(b)});
  const result = context.readState();
  assert.equal(result.schemaVersion,7); assert.equal(result.customFlag,'keep-me');
  assert.equal(result.memory.length,2); assert.equal(result.projects.length,1); assert.equal(result.messages.length,1);
});
test('deduplicates identical records during migration', () => {
  const record={title:'same',body:'note'};
  const {context}=loadStore({mr_ai_v06_store:JSON.stringify({memory:[record]}),mr_ai_v05_store:JSON.stringify({memory:[record]})});
  assert.equal(context.readState().memory.length,1);
});
test('ignores malformed legacy JSON while retaining valid primary data', () => {
  const {context}=loadStore({mr_ai_v06_store:JSON.stringify({memory:[{title:'safe'}]}),mr_ai_v05_store:'{broken'});
  assert.equal(context.readState().memory[0].title,'safe');
});
test('normalizes missing collections without discarding extra fields', () => {
  const {context}=loadStore();
  const result=context.normalizeState({schemaVersion:7, extra:'preserved', memory:'bad'});
  assert.deepEqual(Array.from(result.memory),[]); assert.equal(result.extra,'preserved');
  assert.deepEqual(Array.from(result.archivedProjects),[]);
});

test('backup merge preserves unknown fields from both sources and current values win', () => {
  const {context} = loadStore();
  const current = {customCurrent:'keep-current', sharedSetting:'current', memory:[{title:'current'}], projects:[]};
  const incoming = {customIncoming:'keep-incoming', sharedSetting:'backup', memory:[{title:'backup'}], projects:[], futurePayload:{enabled:true}};
  const result = context.mergeBackup(current, incoming);
  assert.equal(result.customCurrent, 'keep-current');
  assert.equal(result.customIncoming, 'keep-incoming');
  assert.equal(result.sharedSetting, 'current');
  assert.deepEqual(JSON.parse(JSON.stringify(result.futurePayload)), {enabled:true});
  assert.equal(result.schemaVersion, 14);
  assert.equal(result.memory.length, 2);
});

test('backup merge does not mutate either input object', () => {
  const {context} = loadStore();
  const current = {memory:[{title:'current'}], projects:[]};
  const incoming = {memory:[{title:'backup'}], projects:[]};
  context.mergeBackup(current, incoming);
  assert.equal(current.memory.length, 1);
  assert.equal(incoming.memory.length, 1);
});
test('preserves project tasks through normalization and backup merge', () => {
  const {context} = loadStore();
  const project = {name:'AquaSmart M R', tasks:[{id:'t1', title:'Review pond data', done:false}]};
  const normalized = context.normalizeState({projects:[project]});
  assert.equal(normalized.projects[0].tasks[0].title, 'Review pond data');
  const merged = context.mergeBackup({projects:[project]}, {projects:[{name:'Other', tasks:[{id:'t2',title:'Prepare report',done:true}]}]});
  assert.equal(merged.projects.length, 2);
  assert.equal(merged.projects[1].tasks[0].done, true);
});

test('memory search matches title and body case-insensitively and normalizes Unicode', () => {
  const start = source.indexOf('function normalizeMemoryQuery');
  const end = source.indexOf('function renderMemory', start);
  assert.ok(start >= 0 && end > start, 'memory search helpers must exist');
  const context = {};
  vm.createContext(context);
  vm.runInContext(source.slice(start, end) + '\nthis.normalizeMemoryQuery=normalizeMemoryQuery; this.memoryMatches=memoryMatches;', context);
  assert.equal(context.memoryMatches({title:'AquaSmart', body:'Pond records'}, 'aquasmart'), true);
  assert.equal(context.memoryMatches({title:'Project', body:'Temperature log'}, 'temperature'), true);
  assert.equal(context.memoryMatches({title:'Project', body:'Other'}, 'missing'), false);
  assert.equal(context.memoryMatches({title:'Project', body:'Other'}, ''), true);
  assert.equal(context.normalizeMemoryQuery('  ＡＢＣ  '), 'abc');
});


test('memory search includes category and linked project, and category filter is exact', () => {
  const start = source.indexOf('function normalizeMemoryQuery');
  const end = source.indexOf('function refreshMemoryProjectOptions', start);
  assert.ok(start >= 0 && end > start, 'memory matching helpers must exist');
  const context = {}; vm.createContext(context);
  vm.runInContext(source.slice(start, end) + '\nthis.memoryMatches=memoryMatches; this.memoryCategoryMatches=memoryCategoryMatches;', context);
  const note={title:'Farm log',body:'Water temperature',category:'Aquaculture',projectName:'AquaSmart M R'};
  assert.equal(context.memoryMatches(note,'aquasmart'),true);
  assert.equal(context.memoryMatches(note,'aquaculture'),true);
  assert.equal(context.memoryCategoryMatches(note,'Aquaculture'),true);
  assert.equal(context.memoryCategoryMatches(note,'Music'),false);
  assert.equal(context.memoryCategoryMatches(note,''),true);
});

test('assigns stable IDs to legacy projects and notes and migrates unambiguous project links', () => {
  const {context}=loadStore();
  const result=context.readState();
  const migrated=context.ensureStableIds(context.normalizeState({projects:[{name:'AquaSmart'}],memory:[{title:'Pond log',body:'Daily notes',projectName:'AquaSmart'}]}));
  assert.match(migrated.projects[0].id,/^project-/);
  assert.match(migrated.memory[0].id,/^memory-/);
  assert.equal(migrated.memory[0].projectId,migrated.projects[0].id);
});
test('does not guess a project link when legacy project names are ambiguous', () => {
  const {context}=loadStore();
  const migrated=context.ensureStableIds(context.normalizeState({projects:[{name:'Same'},{name:'Same'}],memory:[{title:'Note',body:'Text',projectName:'Same'}]}));
  assert.equal(migrated.memory[0].projectId,undefined);
});
test('notification history survives normalization and backup merge',()=>{
 const {context}=loadStore();
 const notice={id:'n1',title:'AquaSmart',body:'Check pond',priority:'high',readAt:0};
 const normalized=context.normalizeState({notifications:[notice]});
 assert.equal(normalized.notifications.length,1);
 const merged=context.mergeBackup({notifications:[notice]}, {notifications:[{id:'n2',title:'Other',body:'Review report'}]});
 assert.equal(merged.notifications.length,2);
 assert.equal(merged.notifications[0].priority,'high');
});
