// Drives a real Chromium (normal profile, not Playwright's incognito context) through the app menu and screenshots
// each step. Usage in README.md. Coordinates fit a 1100x800 Xvfb screen and Chromium 141.
import pw from '/opt/node-tools/node_modules/playwright/index.js'; const { chromium } = pw;
import { execSync, spawn } from 'node:child_process'; import fs from 'node:fs';
const O = 'http://localhost:8787', OUT = process.argv[2], ORDER = process.argv[3], T = O + '/', C = O + '/chat';
fs.mkdirSync(OUT, { recursive: true });
const prof = OUT + '/profile-' + ORDER; fs.rmSync(prof, { recursive: true, force: true });
const ch = spawn('/opt/pw-browsers/chromium-1194/chrome-linux/chrome', ['--user-data-dir=' + prof, '--remote-debugging-port=9334', '--no-first-run', '--no-sandbox', '--no-default-browser-check', '--window-size=1100,800', '--window-position=0,0', 'about:blank'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.connectOverCDP('http://127.0.0.1:9334');
const ctx = b.contexts()[0]; let p = ctx.pages()[0] || await ctx.newPage();
const bs = await b.newBrowserCDPSession();
// the tab that installed moves into the app window: a new normal browser window for the next step
async function freshTab() { const { targetId } = await bs.send('Target.createTarget', { url: 'about:blank', newWindow: true }); await wait(1500); const pg = ctx.pages().find((x) => x.url() === 'about:blank' && !x.isClosed()); if (pg) p = pg; }
const sh = (n) => execSync(`import -window root ${OUT}/${ORDER}-${n}.png`);
const CLICK = new URL('./click.py', import.meta.url).pathname;
const py = (a) => execSync(`python3 ${CLICK} ${a}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function openShare() { await p.bringToFront(); await wait(1200); py('click 1077 63'); await wait(900); py('move 860 644'); await wait(300); py('click 860 644'); await wait(1200); }
async function close() { py('key Escape'); await wait(300); py('key Escape'); await wait(500); }
async function step(url, tag, install) {
  await p.goto(url); await wait(4000); await openShare(); sh(tag);
  if (install) { py('click 560 585'); await wait(2500); sh(tag + '-dialog'); py('click 713 229'); await wait(5000); sh(tag + '-after'); await freshTab(); }
  else await close();
}
await p.goto(T); await wait(2500); py('click 1073 113'); await wait(800);
if (ORDER === 'probe') { await p.goto(C); await wait(4000); await p.bringToFront(); await wait(1000); await openShare(); sh('menu'); await close(); await b.close().catch(() => {}); ch.kill(); process.exit(0); }
if (ORDER === 'un') {
  await p.goto(T); await wait(2000); await p.evaluate(() => localStorage.setItem('keep_me', 'still here'));
  await openShare(); py('click 560 585'); await wait(2500); py('click 713 229'); await wait(5000);
  sh('1-appwin'); py('click 970 14'); await wait(1200); sh('2-appmenu'); py('click 700 169'); await wait(2000); sh('3-uninstall-dialog'); py('click 703 199'); await wait(3000);
  await freshTab(); await p.goto(C); await wait(4000); await openShare(); sh('4-chat-after-uninstall');
  py('click 560 585'); await wait(2500); py('click 713 229'); await wait(5000); sh('5-assistant-installed'); await freshTab();
  await p.goto(T); await wait(3500); console.log('localStorage after uninstall:', await p.evaluate(() => localStorage.getItem('keep_me')));
  await openShare(); sh('6-root'); py('click 560 585'); await wait(2500); py('click 713 229'); await wait(5000); sh('7-tapugan-again'); await freshTab();
  await p.goto(C); await wait(4000); await openShare(); sh('8-chat-final'); await close();
  await p.goto(T + '?emp=1'); await wait(3000); await openShare(); sh('9-shortcut-url-final'); await close();
  await b.close().catch(() => {}); ch.kill(); process.exit(0);
}
const first = ORDER === 'fix' ? C : T, second = ORDER === 'fix' ? T : C;
await step(first, '1', true);
await step(second, '2', true);
await step(C, '3-chat', false);
await step(T, '4-root', false);
await b.close().catch(() => {}); ch.kill();
