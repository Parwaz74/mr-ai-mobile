const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(new URL('./app.js', `file://${__filename}`), 'utf8');
const start = source.indexOf('function projectMatches');
const end = source.indexOf('function renderProjectList', start);
assert.ok(start >= 0 && end > start, 'project helper functions must exist');
const context = {};
vm.createContext(context);
vm.runInContext(source.slice(start, end) + '\nthis.projectMatches=projectMatches;this.projectStatistics=projectStatistics;this.renameProjectLinks=renameProjectLinks;', context);
test('project search matches name and description case-insensitively', () => {
  assert.equal(context.projectMatches({name:'AquaSmart M R',desc:'Fish farm management'}, 'aquasmart'), true);
  assert.equal(context.projectMatches({name:'Project X',desc:'Pond monitoring'}, 'POND'), true);
  assert.equal(context.projectMatches({name:'Project X',desc:'Pond monitoring'}, 'missing'), false);
  assert.equal(context.projectMatches({name:'Project X'}, ''), true);
});
test('project statistics count only notes linked by stable project ID', () => {
  const project={id:'p-1',tasks:[{done:true},{done:false},{done:true}]};
  const notes=[{projectId:'p-1'},{projectId:'p-2'},{projectId:'p-1'}];
  assert.deepEqual(JSON.parse(JSON.stringify(context.projectStatistics(project,notes))), {notes:2,total:3,done:2});
});
test('renaming a project updates denormalized names without changing stable links', () => {
  const notes=[{projectId:'p-1',projectName:'Old'},{projectId:'p-2',projectName:'Old'},{projectId:'p-1',projectName:'Old'}];
  context.renameProjectLinks('p-1','New',notes);
  assert.deepEqual(JSON.parse(JSON.stringify(notes)),[{projectId:'p-1',projectName:'New'},{projectId:'p-2',projectName:'Old'},{projectId:'p-1',projectName:'New'}]);
});
