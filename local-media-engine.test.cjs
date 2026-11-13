const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = require('node:fs').existsSync(path.join(__dirname, 'index.html')) ? __dirname : path.join(__dirname, '..');
test('self-hosted image and video routes are exposed without requiring a vendor image/video API key', () => {
  const server = fs.readFileSync(path.join(root, 'server.mjs'), 'utf8');
  const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  assert.match(server, /\/api\/local-media\/image/);
  assert.match(server, /\/api\/local-media\/video/);
  assert.match(server, /COMFYUI_URL/);
  assert.match(env, /COMFYUI_IMAGE_WORKFLOW=/);
  assert.match(env, /COMFYUI_VIDEO_WORKFLOW=/);
});
test('studio provides self-hosted image and video generation controls', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'media-studio.js'), 'utf8');
  assert.match(html, /id="imageGenerateAI"[^>]*>تولید تصویر روی موتور محلی/);
  assert.match(html, /id="localVideoGenerate"/);
  assert.match(html, /id="localVideoPreview"/);
  assert.match(js, /submitLocalMedia\('image'/);
  assert.match(js, /submitLocalMedia\('video'/);
});
test('workflow placeholder helper preserves numeric JSON types and substitutes prompt text', () => {
  const script = `import {replaceWorkflowTokens} from './local-media-engine.mjs'; const out=replaceWorkflowTokens({p:'{{PROMPT}}',w:'{{WIDTH}}',seed:'{{SEED}}'}, {PROMPT:'hello',WIDTH:832,SEED:42}); console.log(JSON.stringify(out));`;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), { p: 'hello', w: 832, seed: 42 });
});
test('ComfyUI output file references reject traversal and accept normal output metadata', () => {
  const script = `import {validateComfyFileQuery,collectOutputFiles} from './local-media-engine.mjs'; const files=collectOutputFiles({outputs:{'7':{gifs:[{filename:'clip.mp4',subfolder:'mrai',type:'output'}]}}}); console.log(JSON.stringify({bad:validateComfyFileQuery('../secret.png'), good:validateComfyFileQuery('clip.mp4','mrai','output'), files}));`;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const out = JSON.parse(run.stdout);
  assert.equal(out.bad, false); assert.equal(out.good, true); assert.equal(out.files.length, 1);
});

test('service worker cache version is bumped for the new media studio UI', () => { const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'); assert.match(sw,/mr-ai-mobile-v0-10-8/); });

test('reference-image upload endpoint is bounded and uses local ComfyUI upload', () => {
  const server = fs.readFileSync(path.join(root, 'server.mjs'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'media-studio.js'), 'utf8');
  assert.match(server, /api\/local-media\/upload-reference/);
  assert.match(server, /8 \* 1024 \* 1024/);
  assert.match(server, /upload\/image/);
  assert.match(js, /uploadLocalReferenceImage/);
  assert.match(js, /referenceImage/);
});
test('reference workflow loads and VAE-encodes a selected image', () => {
  const wf = JSON.parse(fs.readFileSync(path.join(root, 'workflows/image_reference_api.json'), 'utf8'));
  assert.equal(wf['2'].class_type, 'LoadImage');
  assert.equal(wf['5'].class_type, 'VAEEncode');
  assert.deepEqual(wf['6'].inputs.latent_image, ['5', 0]);
  assert.equal(wf['2'].inputs.image, '{{INPUT_IMAGE}}');
});
