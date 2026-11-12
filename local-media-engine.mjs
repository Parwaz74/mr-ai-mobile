import fs from 'node:fs/promises';
import path from 'node:path';

export function replaceWorkflowTokens(value, values) {
  if (Array.isArray(value)) return value.map(item => replaceWorkflowTokens(item, values));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceWorkflowTokens(item, values)]));
  if (typeof value !== 'string') return value;
  const exact = value.match(/^\{\{([A-Z_]+)\}\}$/);
  if (exact && Object.hasOwn(values, exact[1])) return values[exact[1]];
  return value.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => String(values[key] ?? ''));
}

export async function loadWorkflow(filePath, values) {
  if (!filePath) throw new Error('Workflow file is not configured on the server.');
  const fullPath = path.resolve(filePath);
  const raw = await fs.readFile(fullPath, 'utf8');
  const workflow = JSON.parse(raw);
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow) || !Object.keys(workflow).length) {
    throw new Error('Workflow JSON must be a non-empty ComfyUI API prompt object.');
  }
  return replaceWorkflowTokens(workflow, values);
}

export function collectOutputFiles(historyEntry) {
  const outputs = historyEntry?.outputs;
  if (!outputs || typeof outputs !== 'object') return [];
  const files = [];
  for (const [nodeId, output] of Object.entries(outputs)) {
    if (!output || typeof output !== 'object') continue;
    for (const key of ['images', 'gifs', 'videos', 'audio', 'files']) {
      const items = Array.isArray(output[key]) ? output[key] : [];
      for (const item of items) {
        if (!item || typeof item.filename !== 'string') continue;
        files.push({ nodeId, filename: item.filename, subfolder: typeof item.subfolder === 'string' ? item.subfolder : '', type: typeof item.type === 'string' ? item.type : 'output', mediaType: key });
      }
    }
  }
  const seen = new Set();
  return files.filter(file => {
    const key = `${file.type}/${file.subfolder}/${file.filename}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateComfyFileQuery(filename, subfolder = '', type = 'output') {
  if (typeof filename !== 'string' || !filename || filename.length > 240 || /[\\/\0]/.test(filename) || filename === '.' || filename === '..') return false;
  if (typeof subfolder !== 'string' || subfolder.length > 240 || subfolder.split(/[\\/]/).some(part => part === '..')) return false;
  return ['output', 'temp', 'input'].includes(type);
}
