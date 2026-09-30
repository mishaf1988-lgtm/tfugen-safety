// Upgrade review 19 (30/09/2026, Michael approved): only admin / manager may
// delete or replace a photo (evidence), and password-reset requests come in
// only through the server. Checks the migration, and that nothing the app or
// the server does relied on what was closed.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).substring(0, 300) : '')); } };
const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f) => fs.readFileSync(path.join(here, '../../', f), 'utf8');
const mig = src('migrations/2026-09-30_close_photo_delete_and_reset_insert.sql');
const body = mig.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
const pol = (name) => { const m = new RegExp('CREATE POLICY ' + name + ' ON storage\\.objects[\\s\\S]*?;').exec(body); return m ? m[0] : ''; };

console.log('\n1. the migration');
const del = pol('incidents_photos_delete_named_user'), upd = pol('incidents_photos_update_named_user');
check('delete: admin / manager only', /FOR DELETE/.test(del) && /private\.is_admin_manager\(\)/.test(del), del);
check('replace (update): admin / manager only, in USING and in WITH CHECK', /FOR UPDATE/.test(upd) && (upd.match(/private\.is_admin_manager\(\)/g) || []).length === 2, upd);
check('...still limited to incidents-photos and named users', [del, upd].every((p) => /bucket_id = 'incidents-photos'/.test(p) && /is_anonymous/.test(p)));
check('the anon insert into password_reset_requests is dropped, nothing re-created for anon', /DROP POLICY IF EXISTS anon_can_insert_reset_request ON public\.password_reset_requests;/.test(body) && !/CREATE POLICY [^;]*password_reset_requests[^;]*TO anon/.test(body));
check('uploading a new photo is not touched', !/incidents_photos_insert/.test(body));
check('the rollback is in the file', /-- Rollback/.test(mig) && /CREATE POLICY anon_can_insert_reset_request/.test(mig));

console.log('\n2. nothing relied on it');
const html = src('index.html');
const up = /function _fileUpload\(file,prefix,cb\)\{[\s\S]*?\n\}\n/.exec(html);
check('the app\'s upload does not ask to replace (no x-upsert header)', up && !/'x-upsert'\s*:/.test(up[0]), up && up[0].substring(0, 200));
check('the app never deletes a photo from the browser', !/method:\s*'DELETE'[^;]{0,200}storage\/v1\/object/.test(html) && !/storage\/v1\/object\/[^;]{0,200}method:\s*'DELETE'/.test(html));
check('the app never inserts a reset request itself (only reads / updates them)', !/password_reset_requests['"]?[^;]{0,120}method:\s*'POST'/.test(html));
const sr = src('functions/api/self-recovery.js');
check('/api/self-recovery inserts with the service role key', /apikey: serviceKey/.test(sr) && /rest\/v1\/password_reset_requests`, \{/.test(sr));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
