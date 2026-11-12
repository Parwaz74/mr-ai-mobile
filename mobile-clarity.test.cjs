'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('style.css','utf8');
const sw=fs.readFileSync('sw.js','utf8');

test('visible build metadata consistently identifies 0.10.10',()=>{
  assert.match(html,/Version 0\.10\.10/);
  assert.match(html,/internal review build 0\.10\.10/);
});
test('navigation tabs are explicit buttons',()=>{
  assert.equal((html.match(/data-view="(?:chat|studio|memory|projects|tools)"/g)||[]).length,5);
  assert.equal((html.match(/<button type="button" class="tab/g)||[]).length,5);
});
test('direct-file mode explains secure-context limitations without disabling chat',()=>{
  assert.match(html,/id="runModeNotice"/);
  assert.match(app,/function explainRunMode\(\)/);
  assert.match(app,/location\.protocol==='file:'/);
  assert.match(app,/\$\('#chatForm'\)\.onsubmit/);
});
test('mobile controls have accessible touch sizing and focus visibility',()=>{
  assert.match(css,/\.tab, \.primary, \.voice-btn, \.install-app, \.ghost \{ min-height: 44px; \}/);
  assert.match(css,/button:focus-visible/);
});
test('service worker uses the 0.10.10 cache and retires 0.10.9',()=>{
  assert.match(sw,/mr-ai-mobile-v0-10-10/);
  assert.match(sw,/mr-ai-mobile-v0-10-9/);
});
