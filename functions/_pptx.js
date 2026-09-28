// Read the structure of an existing .pptx (28/09): the slides in order, the
// text of each shape and table, and each chart's series as PowerPoint caches
// them. Read-only; used to learn the weekly committee deck before anything
// writes to it (Michael: "the existing deck, the same look, updated by itself").
import { readZip, entryText } from './_xlsxpatch.js';

const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const texts = (x) => { const out = []; const re = /<a:p\b[\s\S]*?<\/a:p>/g; let m; while ((m = re.exec(x || ''))) { let t = ''; const r = /<a:t>([\s\S]*?)<\/a:t>/g; let k; while ((k = r.exec(m[0]))) t += unesc(k[1]); if (t.trim()) out.push(t); } return out; };
function rels(xml) { const o = {}; const re = /<Relationship\b([^>]*)\/?>/g; let m; while ((m = re.exec(xml || ''))) { const id = (/\bId="([^"]+)"/.exec(m[1]) || [])[1], t = (/\bTarget="([^"]+)"/.exec(m[1]) || [])[1]; if (id) o[id] = t; } return o; }
const join = (base, target) => { if (target.startsWith('/')) return target.substring(1); const p = base.split('/'); p.pop(); target.split('/').forEach((x) => { if (x === '..') p.pop(); else if (x !== '.') p.push(x); }); return p.join('/'); };
const relsOf = (path) => { const i = path.lastIndexOf('/'); return path.substring(0, i) + '/_rels/' + path.substring(i + 1) + '.rels'; };
function cache(x) { const pts = []; const re = /<c:pt idx="(\d+)">\s*<c:v>([\s\S]*?)<\/c:v>/g; let m; while ((m = re.exec(x || ''))) pts[+m[1]] = unesc(m[2]); return pts; }

export async function pptxOutline(bytes) {
  const zip = readZip(bytes);
  const get = async (n) => { const e = zip.find((x) => x.name === n); return e ? entryText(e) : ''; };
  const pres = await get('ppt/presentation.xml');
  const prel = rels(await get('ppt/_rels/presentation.xml.rels'));
  const ids = []; const re = /<p:sldId\b[^>]*r:id="([^"]+)"/g; let m; while ((m = re.exec(pres))) ids.push(m[1]);
  const slides = [];
  for (let i = 0; i < ids.length; i++) {
    const path = join('ppt/presentation.xml', prel[ids[i]]);
    const xml = await get(path);
    const srel = rels(await get(relsOf(path)));
    const shapes = [];
    const sre = /<p:sp\b[\s\S]*?<\/p:sp>/g; let s;
    while ((s = sre.exec(xml))) { const name = (/<p:cNvPr\b[^>]*name="([^"]*)"/.exec(s[0]) || [])[1]; const t = texts(s[0]); if (t.length) shapes.push({ name: unesc(name || ''), text: t }); }
    const tables = [];
    const tre = /<a:tbl>[\s\S]*?<\/a:tbl>/g; let tb;
    while ((tb = tre.exec(xml))) { const rows = []; const rr = /<a:tr\b[\s\S]*?<\/a:tr>/g; let r; while ((r = rr.exec(tb[0]))) { const cells = []; const cr = /<a:tc\b[\s\S]*?<\/a:tc>/g; let c; while ((c = cr.exec(r[0]))) cells.push(texts(c[0]).join(' ')); rows.push(cells); } tables.push(rows); }
    const charts = [];
    const cre = /<c:chart\b[^>]*r:id="([^"]+)"/g; let c;
    while ((c = cre.exec(xml))) {
      const cpath = join(path, srel[c[1]]);
      const cx = await get(cpath);
      const crel = rels(await get(relsOf(cpath)));
      const ext = (/<c:externalData\b[^>]*r:id="([^"]+)"/.exec(cx) || [])[1];
      const kinds = (cx.match(/<c:(bar|line|pie|doughnut|area|scatter|bar3D|pie3D)Chart>/g) || []).map((k) => k.replace(/[<>]|c:|Chart/g, ''));
      const series = [];
      const ser = /<c:ser>[\s\S]*?<\/c:ser>/g; let q;
      while ((q = ser.exec(cx))) {
        const tx = (/<c:tx>([\s\S]*?)<\/c:tx>/.exec(q[0]) || [])[1];
        const cat = (/<c:cat>([\s\S]*?)<\/c:cat>/.exec(q[0]) || [])[1];
        const val = (/<c:val>([\s\S]*?)<\/c:val>/.exec(q[0]) || [])[1];
        series.push({ name: cache(tx)[0] || null, ref: (/<c:f>([\s\S]*?)<\/c:f>/.exec(val || '') || [])[1] || null, cats: cache(cat), vals: cache(val) });
      }
      charts.push({ part: cpath, kinds, title: texts((/<c:title>([\s\S]*?)<\/c:title>/.exec(cx) || [])[1]).join(' ') || null, embedded: ext ? join(cpath, crel[ext]) : null, series });
    }
    slides.push({ n: i + 1, part: path, shapes, tables, charts });
  }
  return { slides };
}
