// Loads functions/api/talk.js in Node for the guide scripts (15/10/2026). talk.js imports its
// neighbours ('../_x.js') and, since 14/10/2026, two siblings ('./hazard-report.js',
// './hazard-file.js'); Node runs them as ES modules only under .mjs. So every helper and the
// three API files are copied flat into a temp dir with their imports pointed at the copies,
// the same mapping as tests/harness/run.sh. A new import in talk.js lands here by itself.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

export async function loadTalk(root) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'talk-mod-'));
  const fix = (s) => s.replace(/'(?:\.\.?\/)(?:api\/)?([\w-]+)\.js'/g, "'./$1.mjs'");
  for (const f of fs.readdirSync(path.join(root, 'functions'))) {
    if (/^_[\w-]+\.js$/.test(f)) fs.writeFileSync(path.join(tmp, f.replace(/\.js$/, '.mjs')), fix(fs.readFileSync(path.join(root, 'functions', f), 'utf8')));
  }
  for (const f of ['talk', 'hazard-report', 'hazard-file']) fs.writeFileSync(path.join(tmp, f + '.mjs'), fix(fs.readFileSync(path.join(root, 'functions/api', f + '.js'), 'utf8')));
  const mod = await import(pathToFileURL(path.join(tmp, 'talk.mjs')).href);
  return { T: mod, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}
