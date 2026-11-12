const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
test('mobile build exposes Android PWA install guidance and event handling',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 const guide=fs.readFileSync(path.join(root,'MOBILE_START_FA.md'),'utf8');
 assert.match(html,/id="installAppButton"/);
 assert.match(html,/mobileInstallNotice/);
 assert.match(app,/beforeinstallprompt/);
 assert.match(app,/appinstalled/);
 assert.match(guide,/Add to Home screen|Install app/);
});
test('mobile build uses a new service worker cache and cleans the previous cache',()=>{
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 assert.match(sw,/mr-ai-mobile-v0-10-9/);
 assert.match(sw,/mr-ai-mobile-v0-10-6/);
});
