var XA={ticks:{color:'#9090a8',font:{family:'Heebo'}},grid:{color:'#2e2e3a'}};
var YA={ticks:{color:'#9090a8',font:{family:'Heebo'}},grid:{color:'#2e2e3a'}};

// ============================================================
// DATA
// ============================================================
var DB = {docs:[],auds:[],ncr:[],inc:[],tr:[],rsk:[],emp:[],files:[],hist:[]};
function ldb() {
  try { var x = localStorage.getItem('tfgn'); if (x) DB = JSON.parse(x); } catch(e) {}
  ['docs','auds','ncr','inc','tr','rsk','emp','files','hist'].forEach(function(k){ DB[k]=DB[k]||[]; });
}
function sdb() { try { localStorage.setItem('tfgn', JSON.stringify(DB)); } catch(e) {} }

// ============================================================
// HELPERS
// ============================================================
var CH = {}, CUR = 'dash', NI = 1, SH = [];
var VM = {dash:null,docs:'m-doc',aud:'m-aud',ncr:'m-ncr',inc:'m-inc',tr:'m-tr',rsk:'m-rsk',files:'fi-up',emp:'m-emp',cal:null,kpi:null,lg:null};

function g(id) { return document.getElementById(id); }
function si(id,v) { var el=g(id); if(el) el.innerHTML=v; }
function gv(id) { var el=g(id); return el?el.value:''; }
function gi(id) { return parseInt(gv(id))||0; }
function gid() { return Date.now().toString(36)+Math.random().toString(36).substr(2,4); }
function fd(d) { if(!d) return '\u2014'; try { return new Date(d).toLocaleDateString('he-IL'); } catch(e) { return d; } }
function du(d) { if(!d) return 999999; return Math.ceil((new Date(d)-new Date())/86400000); }

var SC = {'\u05d1\u05ea\u05d5\u05e7\u05e3':'bG','\u05d4\u05d5\u05e9\u05dc\u05dd':'bG','\u05e1\u05d2\u05d5\u05e8':'bG','\u05d1\u05e1\u05e7\u05d9\u05e8\u05d4':'bY','\u05d1\u05d1\u05d9\u05e6\u05d5\u05e2':'bY','\u05d1\u05d8\u05d9\u05e4\u05d5\u05dc':'bY','\u05d1\u05d7\u05e7\u05d9\u05e8\u05d4':'bY','\u05d1\u05ea\u05d4\u05dc\u05d9\u05da':'bY','\u05de\u05d1\u05d5\u05d8\u05dc':'bR','\u05e4\u05ea\u05d5\u05d7':'bR','\u05e4\u05d2 \u05ea\u05d5\u05e7\u05e3':'bR','\u05de\u05ea\u05d5\u05db\u05e0\u05df':'bB','\u05de\u05de\u05ea\u05d9\u05df \u05dc\u05d0\u05d9\u05e9\u05d5\u05e8':'bB'};
function sb(s) { return '<span class="b '+(SC[s]||'bX')+'">'+s+'</span>'; }
function pb(p) { var m={'\u05e7\u05e8\u05d9\u05d8\u05d9\u05ea':'bR','\u05d2\u05d1\u05d5\u05d4\u05d4':'bO','\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9\u05ea':'bY','\u05e0\u05de\u05d5\u05db\u05d4':'bG'}; return '<span class="b '+(m[p]||'bX')+'">'+p+'</span>'; }
function svb(s) { var m={'\u05e7\u05e8\u05d9\u05d8\u05d9':'bR','\u05d7\u05de\u05d5\u05e8':'bO','\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9':'bY','\u05e7\u05dc':'bG'}; return '<span class="b '+(m[s]||'bX')+'">'+s+'</span>'; }
function rl(r) { if(r>=15) return {l:'\u05e7\u05e8\u05d9\u05d8\u05d9',c:'bR'}; if(r>=9) return {l:'\u05d2\u05d1\u05d5\u05d4',c:'bO'}; if(r>=4) return {l:'\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9',c:'bY'}; return {l:'\u05e0\u05de\u05d5\u05da',c:'bG'}; }
function eb(d) {
  if(!d) return '<span class="b bX">\u2014</span>';
  var x=du(d);
  if(x<0) return '<span class="b bR">\u05e4\u05d2 \u05ea\u05d5\u05e7\u05e3</span>';
  if(x<=30) return '<span class="b bY">'+x+'\u05d9\u05f3</span>';
  return '<span class="b bG">'+fd(d)+'</span>';
}

function toast(msg, col) {
  var t = document.createElement('div');
  t.className = 'toast';
  t.style.borderRight = '3px solid '+(col==='ok'?'var(--ok)':col==='rd'?'var(--rd)':'var(--ac)');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function(){ t.remove(); }, 2600);
}
function addH(ic, tx) {
  DB.hist.unshift({ic:ic,tx:tx,ts:new Date().toISOString()});
  if(DB.hist.length>150) DB.hist=DB.hist.slice(0,150);
}

// ============================================================
// NAVIGATION
// ============================================================
function goPage(v) {
  document.querySelectorAll('.vw').forEach(function(x){ x.classList.remove('on'); });
  var el = g('v-'+v); if(el) el.classList.add('on');
  document.querySelectorAll('.ni,.bi').forEach(function(x){ x.classList.remove('on'); });
  document.querySelectorAll('.ni,.bi').forEach(function(x){
    var o = x.getAttribute('onclick');
    if(o && o.indexOf("'"+v+"'") > -1) x.classList.add('on');
  });
  var ma = g('madd');
  if(ma) ma.style.display = VM[v] ? 'block' : 'none';
  CUR = v;
  var rv = {dash:rDash,docs:rDocs,aud:rAud,ncr:rNcr,inc:rInc,tr:rTr,rsk:rRsk,files:rFi,emp:rEmp,cal:rCal,kpi:rKpi,lg:rLg};
  if(rv[v]) rv[v]();
}
function mAdd() {
  var m = VM[CUR];
  if(!m) return;
  if(m === 'fi-up') { var el=g('fi-up'); if(el) el.click(); }
  else openM(m);
}

function openM(id) {
  var el = g(id); if(!el) return;
  el.classList.add('on');
  var t = new Date().toISOString().split('T')[0];
  el.querySelectorAll('input[type=date]').forEach(function(i){ if(!i.value) i.value=t; });
  el.querySelectorAll('input[type=datetime-local]').forEach(function(i){ if(!i.value) i.value=new Date().toISOString().slice(0,16); });
  // Refresh file list for this modal context
  var ctxMap = {'m-doc':'doc','m-aud':'aud','m-ncr':'ncr','m-inc':'inc','m-tr':'tr','m-rsk':'rsk'};
  var ctx = ctxMap[id];
  if(ctx) renderFL(ctx);
  // Init sig for training modal
  if(id === 'm-tr') setTimeout(initSig, 100);
}
function closeM(id) { var el=g(id); if(el) el.classList.remove('on'); }
document.addEventListener('click', function(e){
  var r=g('srch-rs'); if(r&&e.target.id!=='srch') r.classList.remove('open');
});

// ============================================================
// THEME & SEARCH
// ============================================================
function toggleTheme() {
  document.body.classList.toggle('light');
  localStorage.setItem('tfgn-t', document.body.classList.contains('light')?'l':'d');
}
if(localStorage.getItem('tfgn-t')==='l') document.body.classList.add('light');

function doSearch(q) {
  var rs = g('srch-rs'); if(!rs) return;
  if(!q||!q.trim()){ rs.classList.remove('open'); return; }
  q = q.toLowerCase(); SH = [];
  DB.docs.forEach(function(d){ if(d.n.toLowerCase().indexOf(q)>-1) SH.push({ic:'&#128196;',t:d.n,v:'docs'}); });
  DB.auds.forEach(function(a){ if(a.n.toLowerCase().indexOf(q)>-1) SH.push({ic:'&#128269;',t:a.n,v:'aud'}); });
  DB.inc.forEach(function(i){ if(i.d.toLowerCase().indexOf(q)>-1) SH.push({ic:'&#9888;',t:i.d,v:'inc'}); });
  DB.ncr.forEach(function(n){ if(n.d.toLowerCase().indexOf(q)>-1) SH.push({ic:'&#128295;',t:n.d,v:'ncr'}); });
  DB.tr.forEach(function(t){ if((t.w+' '+t.n).toLowerCase().indexOf(q)>-1) SH.push({ic:'&#127891;',t:t.w+'-'+t.n,v:'tr'}); });
  DB.rsk.forEach(function(r){ if(r.d.toLowerCase().indexOf(q)>-1) SH.push({ic:'&#9889;',t:r.d,v:'rsk'}); });
  DB.emp.forEach(function(e){ if(e.n.toLowerCase().indexOf(q)>-1) SH.push({ic:'&#128100;',t:e.n,v:'emp'}); });
  SH = SH.slice(0,7);
  if(!SH.length) {
    rs.innerHTML='<div class="si" style="color:var(--t3)">\u05d0\u05d9\u05df \u05ea\u05d5\u05e6\u05d0\u05d5\u05ea</div>';
  } else {
    rs.innerHTML = SH.map(function(h,i){ return '<div class="si" onclick="srGo('+i+')">'+h.ic+' '+h.t.substring(0,42)+'</div>'; }).join('');
  }
  rs.classList.add('open');
}
function srGo(i) { var h=SH[i]; if(!h) return; g('srch-rs').classList.remove('open'); goPage(h.v); }

// ============================================================
// NOTIFICATIONS
// ============================================================
function buildNotifs() {
  var items = [];
  DB.docs.forEach(function(d){ var x=du(d.e); if(x>=0&&x<=30) items.push('&#9888; \u05de\u05e1\u05de\u05da: '+d.n.substring(0,28)+' \u2014 \u05e4\u05d2 \u05d1\u05e2\u05d5\u05d3 '+x+' \u05d9\u05de\u05d9\u05dd'); });
  DB.tr.forEach(function(t){ var x=du(t.e); if(x>=0&&x<=30) items.push('&#10160; \u05d4\u05d3\u05e8\u05db\u05d4: '+t.w+' | '+t.n.substring(0,18)+' \u2014 '+x+' \u05d9\u05de\u05d9\u05dd'); });
  DB.ncr.filter(function(n){ return n.s!=='\u05e1\u05d2\u05d5\u05e8'&&du(n.u)<0; }).forEach(function(n){ items.push('&#128308; '+(n.num||'NCR')+' \u2014 CAPA \u05e2\u05d1\u05e8 \u05d9\u05e2\u05d3!'); });
  DB.rsk.filter(function(r){ return r.p*r.sv>=15; }).forEach(function(r){ items.push('&#9889; \u05e1\u05d9\u05db\u05d5\u05df \u05e7\u05e8\u05d9\u05d8\u05d9 RPN='+(r.p*r.sv)); });
  DB.inc.filter(function(i){ return i.s==='\u05e4\u05ea\u05d5\u05d7'; }).forEach(function(i){ items.push('&#128270; \u05d0\u05d9\u05e8\u05d5\u05e2 \u05e4\u05ea\u05d5\u05d7: '+i.d.substring(0,30)); });
  var bd=g('bell-dot'); if(bd) bd.style.display=items.length?'block':'none';
  var nl=g('ntnl'); if(!nl) return;
  nl.innerHTML = items.length
    ? items.map(function(i){ return '<div class="nt-item">'+i+'</div>'; }).join('')
    : '<div style="padding:14px;text-align:center;color:var(--t3);font-size:12px">\u05d4\u05db\u05dc \u05ea\u05e7\u05d9\u05df &#10003;</div>';
}
function toggleNotif() { var p=g('ntp'); if(p){ p.classList.toggle('on'); if(p.classList.contains('on')) buildNotifs(); } }

// ============================================================
// FILE MANAGEMENT
// ============================================================
function getFileIcon(name) {
  var ext = (name||'').split('.').pop().toLowerCase();
  if(['jpg','jpeg','png','gif','webp','bmp'].indexOf(ext)>-1) return '&#128444;';
  if(ext==='pdf') return '&#128196;';
  if(['doc','docx'].indexOf(ext)>-1) return '&#128221;';
  if(['xls','xlsx','csv'].indexOf(ext)>-1) return '&#128202;';
  if(['ppt','pptx'].indexOf(ext)>-1) return '&#128203;';
  if(['mp4','mov','avi'].indexOf(ext)>-1) return '&#127916;';
  if(['zip','rar','7z'].indexOf(ext)>-1) return '&#128540;';
  return '&#128206;';
}
function isImg(name) {
  var ext=(name||'').split('.').pop().toLowerCase();
  return ['jpg','jpeg','png','gif','webp','bmp'].indexOf(ext)>-1;
}
function fmtSz(b) {
  if(b<1024) return b+' B';
  if(b<1048576) return Math.round(b/1024)+' KB';
  return (b/1048576).toFixed(1)+' MB';
}

function pickFile(event, ctx) {
  var files = event.target.files;
  if(!files||!files.length) return;
  Array.from(files).forEach(function(file){ readFile(file, ctx); });
  event.target.value = '';
}
function dropFile(event, ctx) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag');
  Array.from(event.dataTransfer.files).forEach(function(file){ readFile(file, ctx); });
}
function readFile(file, ctx) {
  // Limit: 5MB per file
  if(file.size > 5*1024*1024) { toast(file.name+' \u05d2\u05d3\u05d5\u05dc \u05de\u05d3\u05d9 (\u05de\u05e7\u05e1 5MB)', 'rd'); return; }
  var rd = new FileReader();
  rd.onload = function(e) {
    var rec = {id:gid(),name:file.name,size:file.size,type:file.type,ctx:ctx,data:e.target.result,ts:new Date().toISOString()};
    DB.files.push(rec);
    sdb();
    addH('\u05e7\u05d5\u05d1\u05e5','\u05d4\u05d5\u05e2\u05dc\u05d4: '+file.name);
    renderFL(ctx);
    if(CUR==='files') rFi();
    si('k8', DB.files.length.toString());
    toast(file.name+' \u05d4\u05d5\u05e2\u05dc\u05d4 &#10003;','ok');
  };
  rd.readAsDataURL(file);
}
function delFile(fid) {
  if(!confirm('\u05dc\u05de\u05d7\u05d5\u05e7 \u05e7\u05d5\u05d1\u05e5 \u05d6\u05d4?')) return;
  var f = DB.files.find(function(x){ return x.id===fid; });
  var ctx = f ? f.ctx : '';
  DB.files = DB.files.filter(function(x){ return x.id!==fid; });
  sdb();
  renderFL(ctx);
  if(CUR==='files') rFi();
  si('k8', DB.files.length.toString());
  toast('\u05e7\u05d5\u05d1\u05e5 \u05e0\u05de\u05d7\u05e7','rd');
}
function renderFL(ctx) {
  var el = g('fl-'+ctx); if(!el) return;
  var list = DB.files.filter(function(f){ return f.ctx===ctx; }).slice(-5).reverse();
  if(!list.length){ el.innerHTML=''; return; }
  el.innerHTML = list.map(function(f){
    return '<div class="fi-item">'
      +(isImg(f.name)?'<img class="fi-img" src="'+f.data+'" alt="">':'<div class="fi-ic">'+getFileIcon(f.name)+'</div>')
      +'<div class="fi-inf"><div class="fi-nm">'+f.name+'</div><div class="fi-sz">'+fmtSz(f.size)+'</div></div>'
      +'<a class="fi-dl" href="'+f.data+'" download="'+f.name+'">&#11015;</a>'
      +'<button class="fi-del" onclick="delFile(\''+f.id+'\')">&#10005;</button>'
      +'</div>';
  }).join('');
}
function rFi() {
  var flt = gv('fi-flt');
  var data = flt ? DB.files.filter(function(f){ return f.ctx===flt; }) : DB.files;
  data = data.slice().reverse();
  var grid=g('fi-grid'), empty=g('fi-empty');
  if(!data.length){ if(grid) grid.innerHTML=''; if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  var lbls = {doc:'\u05de\u05e1\u05de\u05da ISO',aud:'\u05d1\u05d9\u05e7\u05d5\u05e8\u05ea',inc:'\u05d0\u05d9\u05e8\u05d5\u05e2',ncr:'CAPA',rsk:'\u05e1\u05d9\u05db\u05d5\u05df',tr:'\u05d4\u05d3\u05e8\u05db\u05d4',gen:'\u05db\u05dc\u05dc\u05d9'};
  if(grid) grid.innerHTML = data.map(function(f){
    var dt = new Date(f.ts).toLocaleDateString('he-IL');
    return '<div class="fc">'
      +'<div class="fc-th">'+(isImg(f.name)?'<img src="'+f.data+'" alt="'+f.name+'">':(getFileIcon(f.name)))+'</div>'
      +'<div class="fc-nm" title="'+f.name+'">'+f.name+'</div>'
      +'<div class="fc-mt">'+fmtSz(f.size)+' | '+dt+'</div>'
      +'<div class="fc-mt"><span class="b bB">'+(lbls[f.ctx]||f.ctx)+'</span></div>'
      +'<div class="fc-ac">'
      +'<a class="btn bg2 bs" href="'+f.data+'" download="'+f.name+'" style="flex:1;justify-content:center">&#11015; \u05d4\u05d5\u05e8\u05d3</a>'
      +'<button class="btn bd bs" onclick="delFile(\''+f.id+'\')">&#128465;</button>'
      +'</div></div>';
  }).join('');
}

// ============================================================
// SIGNATURE
// ============================================================
var sigData=null,sigDraw=false,sigCtx=null;
function initSig() {
  var c=g('sig-cv'); if(!c) return;
  var rr=c.getBoundingClientRect(); c.width=rr.width>0?rr.width:260; c.height=110;
  sigCtx=c.getContext('2d'); sigCtx.strokeStyle='#f5c518'; sigCtx.lineWidth=2.5; sigCtx.lineCap='round';
  var lb=g('sig-lb');
  function pos(e){ var r=c.getBoundingClientRect(); var t=e.touches?e.touches[0]:e; return{x:t.clientX-r.left,y:t.clientY-r.top}; }
  c.onmousedown=c.ontouchstart=function(e){ e.preventDefault(); sigDraw=true; var p=pos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x,p.y); if(lb) lb.style.display='none'; };
  c.onmousemove=c.ontouchmove=function(e){ e.preventDefault(); if(!sigDraw) return; var p=pos(e); sigCtx.lineTo(p.x,p.y); sigCtx.stroke(); };
  c.onmouseup=c.ontouchend=function(){ sigDraw=false; sigData=c.toDataURL(); };
}
function clearSig() { var c=g('sig-cv'); if(c&&sigCtx) sigCtx.clearRect(0,0,c.width,c.height); sigData=null; var l=g('sig-lb'); if(l) l.style.display='block'; }

// ============================================================
// SAVE FUNCTIONS
// ============================================================
function svDoc() {
  var n=gv('d-n').trim(); if(!n){ alert('\u05d9\u05e9 \u05dc\u05d4\u05d6\u05d9\u05df \u05e9\u05dd \u05de\u05e1\u05de\u05da'); return; }
  var _doc={id:gid(),n:n,c:gv('d-c'),v:gv('d-v')||'1.0',o:gv('d-o'),u:gv('d-u'),e:gv('d-e'),s:gv('d-s'),i:gv('d-i'),nt:gv('d-nt')};DB.docs.push(_doc);sbSave('docs',_doc);
  addH('\u05de\u05e1\u05de\u05da','\u05e0\u05d5\u05e1\u05e3: '+n); sdb(); closeM('m-doc');
  ['d-n','d-o','d-nt','d-i'].forEach(function(i){ var el=g(i); if(el) el.value=''; });
  var dv=g('d-v'); if(dv) dv.value='1.0';
  toast('\u05de\u05e1\u05de\u05da \u05e0\u05d5\u05e1\u05e3 &#10003;','ok'); rDocs();
}
function svAud() {
  var n=gv('a-n').trim(); if(!n){ alert('\u05d9\u05e9 \u05dc\u05d4\u05d6\u05d9\u05df \u05e0\u05d5\u05e9\u05d0'); return; }
  var _r={id:gid(),n:n,a:gv('a-a'),r:gv('a-r'),d:gv('a-d'),f:gi('a-f'),sc:gi('a-sc'),s:gv('a-st'),sm:gv('a-sm')};DB.auds.push(_r);sbSave('auds',_r);
  addH('\u05d1\u05d9\u05e7\u05d5\u05e8\u05ea','\u05e0\u05d5\u05e1\u05e4\u05d4: '+n); sdb(); closeM('m-aud');
  ['a-n','a-a','a-sm'].forEach(function(i){ var el=g(i); if(el) el.value=''; });
  toast('\u05d1\u05d9\u05e7\u05d5\u05e8\u05ea \u05e0\u05d5\u05e1\u05e4\u05d4 &#10003;','ok'); rAud();
}
function svNcr() {
  var d=gv('nc-d').trim(); if(!d){ alert('\u05d9\u05e9 \u05dc\u05d4\u05d6\u05d9\u05df \u05ea\u05d9\u05d0\u05d5\u05e8'); return; }
  var _r={id:gid(),num:'NCR-'+String(NI++).padStart(4,'0'),d:d,a:gv('nc-a'),p:gv('nc-p'),o:gv('nc-o'),u:gv('nc-u'),s:gv('nc-st'),c:gv('nc-c')};DB.ncr.push(_r);sbSave('ncr',_r);
  addH('NCR','\u05e0\u05d5\u05e1\u05e3: '+d.substring(0,40)); sdb(); closeM('m-ncr');
  ['nc-d','nc-o','nc-c'].forEach(function(i){ var el=g(i); if(el) el.value=''; });
  toast('\u05d0\u05d9-\u05d4\u05ea\u05d0\u05de\u05d4 \u05e0\u05d5\u05e1\u05e4\u05d4 &#10003;','ok'); rNcr();
}
function svInc() {
  var d=gv('i-d').trim(); if(!d){ alert('\u05d9\u05e9 \u05dc\u05d4\u05d6\u05d9\u05df \u05ea\u05d9\u05d0\u05d5\u05e8'); return; }
  var _r={id:gid(),d:d,dt:gv('i-dt'),ty:gv('i-ty'),sv:gv('i-sv'),l:gv('i-l'),dy:gi('i-dy'),s:gv('i-st'),r:gv('i-r'),p:gv('i-p')};DB.inc.push(_r);sbSave('inc',_r);
  addH('\u05d0\u05d9\u05e8\u05d5\u05e2','\u05d3\u05d5\u05d5\u05d7: '+d.substring(0,40)); sdb(); closeM('m-inc');
  ['i-d','i-l','i-w','i-r','i-p'].forEach(function(i){ var el=g(i); if(el) el.value=''; });
  toast('\u05d0\u05d9\u05e8\u05d5\u05e2 \u05d3\u05d5\u05d5\u05d7 &#10003;','ok'); rInc();
}
function svTr() {
  var w=gv('t-w').trim(), n=gv('t-n').trim();
  if(!w||!n){ alert('\u05d9\u05e9 \u05dc\u05d4\u05d6\u05d9\u05df \u05e9\u05dd \u05e2\u05d5\u05d1\u05d3 \u05d5\u05e9\u05dd \u05d4\u05d3\u05e8\u05db\u05d4'); return; }
  var hasSig = !!(sigData&&sigData.length>100);
  var _r={id:gid(),w:w,n:n,c:gv('t-c'),d:gv('t-d'),e:gv('t-e'),sc:gi('t-sc'),s:gv('t-st'),sig:hasSig};DB.tr.push(_r);sbSave('tr',_r);
  addH('\u05d4\u05d3\u05e8\u05db\u05d4','\u05e0\u05e8\u05e9\u05de\u05d4: '+w+' - '+n+(hasSig?' [\u05d7\u05ea\u05d5\u05dd]':'')); sdb(); closeM('m-tr');
  ['t-w','t-n','t-tr'].forEach(function(i){ var el=g(i); if(el) el.value=''; });
  clearSig(); toast('\u05d4\u05d3\u05e8\u05db\u05d4 \u05e0\u05e8\u05e9\u05de\u05d4 &#10003;','ok'); rTr();
}
function svRsk() {
  var d=gv('r-d').trim(); if(!d){ alert('\u05d9\u05e9 \u05dc\u05d4\u05d6\u05d9\u05df \u05ea\u05d9\u05d0\u05d5\u05e8'); return; }
  var _r={id:gid(),d:d,a:gv('r-a'),o:gv('r-o'),p:parseInt(gv('r-p')),sv:parseInt(gv('r-s')),ac:gv('r-ac')};DB.rsk.push(_r);sbSave('rsk',_r);
  addH('\u05e1\u05d9\u05db\u05d5\u05df','\u05e0\u05d5\u05e1\u05e3: '+d.substring(0,40)); sdb(); closeM('m-rsk');
  ['r-d','r-o','r-ct','r-ac'].forEach(function(i){ var el=g(i); if(el) el.value=''; });
  toast('\u05e1\u05d9\u05db\u05d5\u05df \u05e0\u05d5\u05e1\u05e3 &#10003;','ok'); rRsk();
}
function svEmp() {
  var n=gv('e-n').trim(); if(!n){ alert('\u05d9\u05e9 \u05dc\u05d4\u05d6\u05d9\u05df \u05e9\u05dd'); return; }
  var _r={id:gid(),n:n,r:gv('e-r'),dep:gv('e-d'),s:gv('e-s'),ph:gv('e-ph')};DB.emp.push(_r);sbSave('emp',_r);
  addH('\u05e2\u05d5\u05d1\u05d3','\u05e0\u05d5\u05e1\u05e3: '+n); sdb(); closeM('m-emp');
  ['e-n','e-r','e-d','e-s','e-id','e-ph'].forEach(function(i){ var el=g(i); if(el) el.value=''; });
  toast('\u05e2\u05d5\u05d1\u05d3 \u05e0\u05d5\u05e1\u05e3 &#10003;','ok'); rEmp();
}
function delRec(store, id, fn) {
  if(!confirm('\u05dc\u05de\u05d7\u05d5\u05e7?')) return;
  DB[store]=DB[store].filter(function(i){ return i.id!==id; });
  addH('\u05de\u05d7\u05d9\u05e7\u05d4','\u05e4\u05e8\u05d9\u05d8 \u05e0\u05de\u05d7\u05e7 \u05de-'+store); sdb(); fn();
  if(CUR==='dash') rDash();
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================
function rDocs() {
  var data=DB.docs;
  si('doc-tb', data.length ? data.map(function(d){
    var fc=DB.files.filter(function(f){ return f.ctx==='doc'; }).length;
    var docFc=DB.files.filter(function(f){ return f.ctx==='doc'; }).length;
    return '<tr><td><div style="font-weight:700">'+d.n+'</div></td>'
      +'<td><span class="b bB">'+d.c+'</span></td>'
      +'<td><span class="b bX">v'+d.v+'</span></td>'
      +'<td>'+(d.o||'\u2014')+'</td>'
      +'<td>'+eb(d.e)+'</td>'
      +'<td>'+sb(d.s)+'</td>'
      +'<td><span style="color:var(--t2);font-size:11px">'+docFc+' &#128193;</span></td>'
      +'<td><button class="btn bd bs" onclick="delRec(\'docs\',\''+d.id+'\',rDocs)">&#128465;</button></td></tr>';
  }).join('') : '<tr><td colspan="8" class="et">&#128196; \u05d0\u05d9\u05df \u05de\u05e1\u05de\u05db\u05d9\u05dd</td></tr>');
  var a=DB.docs.filter(function(d){ return d.s==='\u05d1\u05ea\u05d5\u05e7\u05e3'; }).length;
  var e=DB.docs.filter(function(d){ return du(d.e)<0; }).length;
  si('doc-sr','<span class="sp">\u05e1\u05d4"\u05db <strong>'+DB.docs.length+'</strong></span>'
    +'<span class="sp">\u05d1\u05ea\u05d5\u05e7\u05e3 <strong>'+a+'</strong></span>'
    +(e>0?'<span class="sp" style="color:var(--rd)">\u05e4\u05d2\u05d9 \u05ea\u05d5\u05e7\u05e3 <strong>'+e+'</strong></span>':''));
}
function rAud() {
  si('aud-tb', DB.auds.length ? DB.auds.map(function(a){
    return '<tr><td style="font-weight:700">'+a.n+'</td>'
      +'<td>'+(a.a||'\u2014')+'</td>'
      +'<td><span class="b bB">'+a.r+'</span></td>'
      +'<td>'+fd(a.d)+'</td>'
      +'<td>'+(a.f>0?'<span style="color:var(--wn);font-weight:700">'+a.f+'</span>':'0')+'</td>'
      +'<td>'+(a.sc?'<span style="font-weight:700;color:'+(a.sc>=80?'var(--ok)':a.sc>=60?'var(--wn)':'var(--rd)')+'">'+a.sc+'%</span>':'\u2014')+'</td>'
      +'<td>'+sb(a.s)+'</td>'
      +'<td><span style="color:var(--t2);font-size:11px">'+DB.files.filter(function(f){ return f.ctx==='aud'; }).length+'&#128193;</span></td>'
      +'<td><button class="btn bd bs" onclick="delRec(\'auds\',\''+a.id+'\',rAud)">&#128465;</button></td></tr>';
  }).join('') : '<tr><td colspan="9" class="et">&#128269; \u05d0\u05d9\u05df \u05d1\u05d9\u05e7\u05d5\u05e8\u05d5\u05ea</td></tr>');
  var c=DB.auds.filter(function(a){ return a.s==='\u05d4\u05d5\u05e9\u05dc\u05dd'; }).length;
  var ws=DB.auds.filter(function(a){ return a.sc; });
  var av=ws.length?Math.round(ws.reduce(function(s,a){ return s+a.sc; },0)/ws.length):0;
  si('aud-sr','<span class="sp">\u05e1\u05d4"\u05db <strong>'+DB.auds.length+'</strong></span><span class="sp">\u05d4\u05d5\u05e9\u05dc\u05de\u05d5 <strong>'+c+'</strong></span><span class="sp">\u05de\u05de\u05d5\u05e6\u05e2 <strong>'+av+'%</strong></span>');
}
function rNcr() {
  si('ncr-tb', DB.ncr.length ? DB.ncr.map(function(n){
    return '<tr><td><span class="b bX">'+(n.num||'\u2014')+'</span></td>'
      +'<td style="max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700">'+n.d+'</td>'
      +'<td>'+pb(n.p)+'</td>'
      +'<td>'+(n.o||'\u2014')+'</td>'
      +'<td>'+(n.u?'<span style="color:'+(du(n.u)<0?'var(--rd)':du(n.u)<7?'var(--wn)':'var(--tx)')+'">'+fd(n.u)+'</span>':'\u2014')+'</td>'
      +'<td>'+sb(n.s)+'</td>'
      +'<td><span style="color:var(--t2);font-size:11px">'+DB.files.filter(function(f){ return f.ctx==='ncr'; }).length+'&#128193;</span></td>'
      +'<td><button class="btn bd bs" onclick="delRec(\'ncr\',\''+n.id+'\',rNcr)">&#128465;</button></td></tr>';
  }).join('') : '<tr><td colspan="8" class="et">&#128295; \u05d0\u05d9\u05df \u05d0\u05d9-\u05d4\u05ea\u05d0\u05de\u05d5\u05ea</td></tr>');
  var o=DB.ncr.filter(function(n){ return n.s!=='\u05e1\u05d2\u05d5\u05e8'; }).length;
  var cr=DB.ncr.filter(function(n){ return n.p==='\u05e7\u05e8\u05d9\u05d8\u05d9\u05ea'&&n.s!=='\u05e1\u05d2\u05d5\u05e8'; }).length;
  si('ncr-sr','<span class="sp">\u05e1\u05d4"\u05db <strong>'+DB.ncr.length+'</strong></span><span class="sp">\u05e4\u05ea\u05d5\u05d7\u05d5\u05ea <strong>'+o+'</strong></span>'+(cr>0?'<span class="sp" style="color:var(--rd)">\u05e7\u05e8\u05d9\u05d8\u05d9\u05d5\u05ea <strong>'+cr+'</strong></span>':''));
  NI=DB.ncr.reduce(function(mx,n){ var num=parseInt((n.num||'NCR-0').split('-')[1])||0; return Math.max(mx,num); },0)+1;
}
function rInc() {
  si('inc-tb', DB.inc.length ? DB.inc.slice().sort(function(a,b){ return new Date(b.dt)-new Date(a.dt); }).map(function(i){
    return '<tr><td>'+fd(i.dt)+'</td>'
      +'<td style="max-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700">'+i.d+'</td>'
      +'<td><span class="b bB">'+i.ty+'</span></td>'
      +'<td>'+svb(i.sv)+'</td>'
      +'<td>'+(i.l||'\u2014')+'</td>'
      +'<td>'+(i.dy>0?'<span style="color:var(--rd);font-weight:700">'+i.dy+'</span>':'0')+'</td>'
      +'<td>'+sb(i.s)+'</td>'
      +'<td><span style="color:var(--t2);font-size:11px">'+DB.files.filter(function(f){ return f.ctx==='inc'; }).length+'&#128193;</span></td>'
      +'<td><button class="btn bd bs" onclick="delRec(\'inc\',\''+i.id+'\',rInc)">&#128465;</button></td></tr>';
  }).join('') : '<tr><td colspan="9" class="et">&#9989; \u05d0\u05d9\u05df \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd</td></tr>');
  var td=DB.inc.reduce(function(s,i){ return s+i.dy; },0);
  var o=DB.inc.filter(function(i){ return i.s==='\u05e4\u05ea\u05d5\u05d7'; }).length;
  si('inc-sr','<span class="sp">\u05e1\u05d4"\u05db <strong>'+DB.inc.length+'</strong></span><span class="sp">\u05e4\u05ea\u05d5\u05d7\u05d9\u05dd <strong>'+o+'</strong></span><span class="sp">\u05d9\u05de\u05d9 \u05d0\u05d1\u05d3\u05df <strong>'+td+'</strong></span>');
  var ib=g('ibg'); if(ib){ ib.style.display=o>0?'inline':'none'; ib.textContent=o; }
}
function rTr() {
  si('tr-tb', DB.tr.length ? DB.tr.map(function(t){
    return '<tr><td style="font-weight:700">'+t.w+'</td>'
      +'<td>'+t.n+'</td>'
      +'<td><span class="b bB">'+t.c+'</span></td>'
      +'<td>'+fd(t.d)+'</td>'
      +'<td>'+eb(t.e)+'</td>'
      +'<td>'+(t.sc?'<span style="font-weight:700;color:'+(t.sc>=80?'var(--ok)':t.sc>=60?'var(--wn)':'var(--rd)')+'">'+t.sc+'%</span>':'\u2014')+'</td>'
      +'<td>'+(t.sig?'<span class="b bG">&#10003; \u05d7\u05ea\u05d5\u05dd</span>':'\u2014')+'</td>'
      +'<td>'+sb(t.s)+'</td>'
      +'<td><span style="color:var(--t2);font-size:11px">'+DB.files.filter(function(f){ return f.ctx==='tr'; }).length+'&#128193;</span></td>'
      +'<td><button class="btn bd bs" onclick="delRec(\'tr\',\''+t.id+'\',rTr)">&#128465;</button></td></tr>';
  }).join('') : '<tr><td colspan="10" class="et">&#127891; \u05d0\u05d9\u05df \u05d4\u05d3\u05e8\u05db\u05d5\u05ea</td></tr>');
  var v=DB.tr.filter(function(t){ return t.s==='\u05d4\u05d5\u05e9\u05dc\u05dd'&&du(t.e)>=0; }).length;
  var e=DB.tr.filter(function(t){ return du(t.e)<0; }).length;
  si('tr-sr','<span class="sp">\u05e1\u05d4"\u05db <strong>'+DB.tr.length+'</strong></span><span class="sp">\u05d1\u05ea\u05d5\u05e7\u05e3 <strong>'+v+'</strong></span>'+(e>0?'<span class="sp" style="color:var(--rd)">\u05e4\u05d2\u05d9 \u05ea\u05d5\u05e7\u05e3 <strong>'+e+'</strong></span>':''));
}
function rRsk() {
  bMat();
  var cr=DB.rsk.filter(function(r){ return r.p*r.sv>=15; });
  si('crl', cr.length ? cr.map(function(r){
    return '<div style="padding:7px 0;border-bottom:1px solid var(--br)"><div style="font-weight:700;font-size:12px">'+r.d+'</div><div style="font-size:10px;color:var(--t3)">'+r.a+' | RPN: '+r.p*r.sv+'</div></div>';
  }).join('') : '<div style="color:var(--ok);padding:7px 0">&#9989; \u05d0\u05d9\u05df \u05e1\u05d9\u05db\u05d5\u05e0\u05d9\u05dd \u05e7\u05e8\u05d9\u05d8\u05d9\u05d9\u05dd</div>');
  si('rsk-tb', DB.rsk.length ? DB.rsk.map(function(r){
    var rpn=r.p*r.sv, lv=rl(rpn);
    return '<tr><td style="font-weight:700">'+r.d+'</td>'
      +'<td><span class="b bB">'+r.a+'</span></td>'
      +'<td style="text-align:center">'+r.p+'</td>'
      +'<td style="text-align:center">'+r.sv+'</td>'
      +'<td><span style="font-weight:900;font-size:14px;color:'+(rpn>=15?'var(--rd)':rpn>=9?'var(--wn)':rpn>=4?'var(--ac)':'var(--ok)')+'">'+rpn+'</span></td>'
      +'<td><span class="b '+lv.c+'">'+lv.l+'</span></td>'
      +'<td>'+(r.o||'\u2014')+'</td>'
      +'<td><span style="color:var(--t2);font-size:11px">'+DB.files.filter(function(f){ return f.ctx==='rsk'; }).length+'&#128193;</span></td>'
      +'<td><button class="btn bd bs" onclick="delRec(\'rsk\',\''+r.id+'\',rRsk)">&#128465;</button></td></tr>';
  }).join('') : '<tr><td colspan="9" class="et">&#9889; \u05d0\u05d9\u05df \u05e1\u05d9\u05db\u05d5\u05e0\u05d9\u05dd</td></tr>');
}
function bMat() {
  var m=g('rmt'); if(!m) return; m.innerHTML='';
  ['','1','2','3','4','5'].forEach(function(l,i){ var c=document.createElement('div'); c.className='rl2'; c.textContent=i?l:''; m.appendChild(c); });
  for(var sv=5;sv>=1;sv--){
    var sl=document.createElement('div'); sl.className='rl2'; sl.textContent=sv; m.appendChild(sl);
    for(var p=1;p<=5;p++){
      var rpn=p*sv, c=document.createElement('div');
      c.className='rc '+(rpn>=15?'rcr':rpn>=9?'rhi':rpn>=4?'rme':'rlo');
      var h=DB.rsk.filter(function(r){ return r.p===p&&r.sv===sv; });
      if(h.length) c.innerHTML='<span style="font-size:11px;font-weight:900">'+h.length+'</span>';
      c.title=h.map(function(r){ return r.d; }).join('\n');
      m.appendChild(c);
    }
  }
}
function rEmp() {
  var eg=g('emp-grid'); if(!eg) return;
  if(!DB.emp.length){ eg.innerHTML='<div style="grid-column:1/-1;color:var(--t3);font-size:12px;padding:16px 0">\u05d0\u05d9\u05df \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd</div>'; var ed=g('emp-detail'); if(ed) ed.style.display='none'; return; }
  eg.innerHTML=DB.emp.map(function(e){
    var trD=DB.tr.filter(function(t){ return t.w===e.n&&t.s==='\u05d4\u05d5\u05e9\u05dc\u05dd'&&du(t.e)>=0; }).length;
    var trA=DB.tr.filter(function(t){ return t.w===e.n; }).length;
    var pct=trA>0?Math.round(trD/trA*100):0;
    var eid=e.id;
    return '<div class="emp-card" onclick="showEmp(\''+eid+'\')"><div class="emp-av">'+e.n.charAt(0)+'</div>'
      +'<div class="emp-nm">'+e.n+'</div><div class="emp-rl">'+(e.r||'\u05e2\u05d5\u05d1\u05d3')+'</div>'
      +'<div class="emp-pb"><div class="emp-pf" style="width:'+pct+'%"></div></div>'
      +'<div style="font-size:10px;color:var(--t3);margin-top:3px">\u05d4\u05d3\u05e8\u05db\u05d5\u05ea '+pct+'%</div></div>';
  }).join('');
  var ed=g('emp-detail'); if(ed) ed.style.display='none';
}
function showEmp(eid) {
  var e=DB.emp.find(function(x){ return x.id===eid; }); if(!e) return;
  var ed=g('emp-detail'); if(ed) ed.style.display='block';
  si('emp-det-nm',e.n+(e.r?' | '+e.r:'')+(e.dep?' | '+e.dep:''));
  var tbl=g('emp-tr-tb'); if(!tbl) return;
  var list=DB.tr.filter(function(t){ return t.w===e.n; });
  tbl.innerHTML=list.length?list.map(function(t){ return '<tr><td>'+t.n+'</td><td><span class="b bB">'+t.c+'</span></td><td>'+eb(t.e)+'</td><td>'+sb(t.s)+'</td></tr>'; }).join(''):'<tr><td colspan="4" class="et">\u05d0\u05d9\u05df \u05d4\u05d3\u05e8\u05db\u05d5\u05ea</td></tr>';
}
var CAL=new Date();
function rCal() {
  var days=['\u05e9','\u05d0','\u05d1','\u05d2','\u05d3','\u05d4','\u05d5'];
  var hdr=g('cal-hdr'); if(hdr) hdr.innerHTML=days.map(function(d){ return '<div class="cal-dh">'+d+'</div>'; }).join('');
  var mn=CAL.getMonth(),yr=CAL.getFullYear();
  var ti=g('cal-title'); if(ti) ti.textContent=new Date(yr,mn,1).toLocaleDateString('he-IL',{month:'long',year:'numeric'});
  var first=new Date(yr,mn,1),sd=first.getDay(),dim=new Date(yr,mn+1,0).getDate();
  var today=new Date(),ev={};
  DB.docs.forEach(function(d){ if(d.e){ if(!ev[d.e]) ev[d.e]=[]; ev[d.e].push({cls:'ev-doc',t:d.n.substring(0,12)}); } });
  DB.auds.forEach(function(a){ if(a.d){ if(!ev[a.d]) ev[a.d]=[]; ev[a.d].push({cls:'ev-aud',t:a.n.substring(0,12)}); } });
  DB.inc.forEach(function(i){ if(i.dt){ var k=i.dt.substring(0,10); if(!ev[k]) ev[k]=[]; ev[k].push({cls:'ev-inc',t:i.d.substring(0,12)}); } });
  DB.tr.forEach(function(t){ if(t.d){ if(!ev[t.d]) ev[t.d]=[]; ev[t.d].push({cls:'ev-tr',t:t.n.substring(0,12)}); } });
  var grid=g('cal-grid'); if(!grid) return;
  var cells='',pd=new Date(yr,mn,0).getDate();
  for(var i=sd-1;i>=0;i--) cells+='<div class="cal-day othm"><div class="cal-num">'+(pd-i)+'</div></div>';
  for(var d=1;d<=dim;d++){
    var dm=yr+'-'+String(mn+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var isT=(d===today.getDate()&&mn===today.getMonth()&&yr===today.getFullYear());
    var evs=ev[dm]||[];
    cells+='<div class="cal-day'+(isT?' today':'')+'"><div class="cal-num">'+d+'</div>'+evs.slice(0,3).map(function(ev2){ return '<div class="cal-ev '+ev2.cls+'">'+ev2.t+'</div>'; }).join('')+'</div>';
  }
  var rem=(7-(dim+sd)%7)%7;
  for(var n=1;n<=rem;n++) cells+='<div class="cal-day othm"><div class="cal-num">'+n+'</div></div>';
  grid.innerHTML=cells;
}
function prevMo(){ CAL.setMonth(CAL.getMonth()-1); rCal(); }
function nextMo(){ CAL.setMonth(CAL.getMonth()+1); rCal(); }
function rLg() {
  var hl=g('hist-list'); if(!hl) return;
  if(!DB.hist.length){ hl.innerHTML='<div style="color:var(--t3);font-size:12px;padding:16px;text-align:center">\u05d0\u05d9\u05df \u05e4\u05e2\u05d9\u05dc\u05d5\u05ea</div>'; return; }
  hl.innerHTML=DB.hist.map(function(h){
    var dt=new Date(h.ts||Date.now());
    return '<div class="hist-item"><div class="hist-ic">&#128203;</div><div class="hist-tx"><strong>'+h.ic+'</strong> '+h.tx+'</div><div class="hist-tm">'+dt.toLocaleDateString('he-IL')+' '+dt.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})+'</div></div>';
  }).join('');
}

// ============================================================
// DASHBOARD
// ============================================================
function rDash() {
  var dd=g('dd'); if(dd) dd.textContent=new Date().toLocaleDateString('he-IL',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  var ad=DB.docs.filter(function(d){ return d.s==='\u05d1\u05ea\u05d5\u05e7\u05e3'; }).length;
  var ed=DB.docs.filter(function(d){ return du(d.e)<0; }).length;
  si('k1',ad); si('k1s',ed>0?ed+' \u05e4\u05d2\u05d9 \u05ea\u05d5\u05e7\u05e3 &#9888;':'\u05d4\u05db\u05dc \u05d1\u05e1\u05d3\u05e8 &#10003;');
  var yr=new Date().getFullYear();
  var yi=DB.inc.filter(function(i){ try{ return new Date(i.dt).getFullYear()===yr; }catch(e){ return false; } }).length;
  var oi=DB.inc.filter(function(i){ return i.s==='\u05e4\u05ea\u05d5\u05d7'; }).length;
  si('k2',yi); si('k2s',oi+' \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd');
  var tt=DB.tr.length, vt=DB.tr.filter(function(t){ return t.s==='\u05d4\u05d5\u05e9\u05dc\u05dd'&&du(t.e)>=0; }).length;
  si('k3',(tt>0?Math.round(vt/tt*100):0)+'%'); si('k3s',vt+'/'+tt+' \u05d4\u05d3\u05e8\u05db\u05d5\u05ea');
  var oc=DB.ncr.filter(function(n){ return n.s!=='\u05e1\u05d2\u05d5\u05e8'; }).length;
  si('k4',oc); si('k4s',oc>0?'\u05d3\u05d5\u05e8\u05e9\u05d5\u05ea \u05d8\u05d9\u05e4\u05d5\u05dc':'\u05d4\u05db\u05dc \u05e1\u05d2\u05d5\u05e8 &#10003;');
  si('k5',DB.emp.length);
  si('k6',DB.rsk.filter(function(r){ return r.p*r.sv>=15; }).length);
  si('k7',DB.inc.reduce(function(s,i){ return s+i.dy; },0));
  si('k8',DB.files.length);
  var ib=g('ibg'); if(ib){ ib.style.display=oi>0?'inline':'none'; ib.textContent=oi; }
  var al='';
  var es=DB.docs.filter(function(d){ var x=du(d.e); return x>=0&&x<=30; });
  if(es.length) al+='<div class="al aw">&#9888; '+es.length+' \u05de\u05e1\u05de\u05db\u05d9\u05dd \u05e2\u05dd \u05ea\u05d5\u05e7\u05e3 \u05e4\u05d2 \u05d1\u05ea\u05d5\u05da 30 \u05d9\u05d5\u05dd</div>';
  var cr=DB.rsk.filter(function(r){ return r.p*r.sv>=15; });
  if(cr.length) al+='<div class="al ae">&#128308; '+cr.length+' \u05e1\u05d9\u05db\u05d5\u05e0\u05d9\u05dd \u05e7\u05e8\u05d9\u05d8\u05d9\u05d9\u05dd \u05d3\u05d5\u05e8\u05e9\u05d9\u05dd \u05d8\u05d9\u05e4\u05d5\u05dc</div>';
  si('dal',al);
  rIncChart('ci',6); rDocChart();
  var ra=DB.auds.slice().sort(function(a,b){ return new Date(b.d)-new Date(a.d); }).slice(0,4);
  si('dau',ra.length?ra.map(function(a){ return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--br)"><div><div style="font-size:12px;font-weight:700">'+a.n+'</div><div style="font-size:10px;color:var(--t3)">'+fd(a.d)+'</div></div>'+sb(a.s)+'</div>'; }).join(''):'<div style="color:var(--t3);font-size:12px;padding:6px 0">\u05d0\u05d9\u05df \u05d1\u05d9\u05e7\u05d5\u05e8\u05d5\u05ea</div>');
  var exp=[];
  DB.docs.forEach(function(d){ var x=du(d.e); if(x>=0&&x<=60) exp.push({n:d.n,d:x,t:'\u05de\u05e1\u05de\u05da'}); });
  DB.tr.forEach(function(t){ var x=du(t.e); if(x>=0&&x<=60) exp.push({n:t.n+' ('+t.w+')',d:x,t:'\u05d4\u05d3\u05e8\u05db\u05d4'}); });
  exp.sort(function(a,b){ return a.d-b.d; });
  si('dex',exp.length?exp.slice(0,5).map(function(e){ return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--br)"><div><div style="font-size:12px;font-weight:700">'+e.n+'</div><div style="font-size:10px;color:var(--t3)">'+e.t+'</div></div><span class="b '+(e.d<=14?'bR':'bY')+'">'+e.d+'\u05d9\u05f3</span></div>'; }).join(''):'<div style="color:var(--t3);font-size:12px;padding:6px 0">\u05d0\u05d9\u05df \u05e4\u05e7\u05d9\u05e2\u05d5\u05ea \u05e7\u05e8\u05d5\u05d1\u05d5\u05ea</div>');
  buildNotifs();
}

// ============================================================
// KPI
// ============================================================
function rKpi() {
  var td=DB.inc.reduce(function(s,i){ return s+i.dy; },0);
  var cr=DB.rsk.filter(function(r){ return r.p*r.sv>=15; }).length;
  var ws=DB.auds.filter(function(a){ return a.sc; });
  var av=ws.length?Math.round(ws.reduce(function(s,a){ return s+a.sc; },0)/ws.length):0;
  var on=DB.ncr.filter(function(n){ return n.s!=='\u05e1\u05d2\u05d5\u05e8'; }).length;
  si('kpi-x','<div class="kc kr"><div class="ki">&#9877;</div><div class="kl">\u05d9\u05de\u05d9 \u05d0\u05d1\u05d3\u05df</div><div class="kv" style="color:var(--rd)">'+td+'</div><div class="ks">LTIF</div></div>'
    +'<div class="kc kb"><div class="ki">&#128269;</div><div class="kl">\u05de\u05de\u05d5\u05e6\u05e2 \u05d1\u05d9\u05e7\u05d5\u05e8\u05ea</div><div class="kv" style="color:var(--a4)">'+av+'%</div><div class="ks">\u05de-'+ws.length+' \u05d1\u05d9\u05e7\u05d5\u05e8\u05d5\u05ea</div></div>'
    +'<div class="kc ky"><div class="ki">&#9889;</div><div class="kl">\u05e1\u05d9\u05db\u05d5\u05e0\u05d9\u05dd \u05e7\u05e8\u05d9\u05d8\u05d9\u05d9\u05dd</div><div class="kv" style="color:var(--ac)">'+cr+'</div><div class="ks">RPN\u226515</div></div>'
    +'<div class="kc kg2"><div class="ki">&#128295;</div><div class="kl">CAPA \u05e4\u05ea\u05d5\u05d7\u05d5\u05ea</div><div class="kv" style="color:var(--ok)">'+on+'</div><div class="ks">\u05de\u05de\u05ea\u05d9\u05e0\u05d5\u05ea</div></div>'
    +'<div class="kc ko"><div class="ki">&#128193;</div><div class="kl">\u05e7\u05d1\u05e6\u05d9\u05dd \u05e9\u05d4\u05d5\u05e2\u05dc\u05d5</div><div class="kv" style="color:#ff6b35">'+DB.files.length+'</div><div class="ks">\u05de\u05e1\u05de\u05db\u05d9\u05dd, \u05ea\u05de\u05d5\u05e0\u05d5\u05ea...</div></div>'
    +'<div class="kc kb"><div class="ki">&#128100;</div><div class="kl">\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd</div><div class="kv" style="color:var(--a4)">'+DB.emp.length+'</div><div class="ks">\u05e8\u05e9\u05d5\u05de\u05d9\u05dd</div></div>'
    +'<div class="kc kr"><div class="ki">&#128196;</div><div class="kl">\u05de\u05e1\u05de\u05db\u05d9 ISO</div><div class="kv" style="color:var(--rd)">'+DB.docs.length+'</div><div class="ks">\u05db\u05d5\u05dc\u05dc \u05db\u05dc \u05d4\u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d5\u05ea</div></div>'
    +'<div class="kc kg2"><div class="ki">&#127891;</div><div class="kl">\u05d4\u05d3\u05e8\u05db\u05d5\u05ea \u05e1\u05d4"\u05db</div><div class="kv" style="color:var(--ok)">'+DB.tr.length+'</div><div class="ks">\u05db\u05dc \u05d4\u05de\u05d5\u05d3\u05d5\u05dc\u05d9\u05dd</div></div>');
  rIncChart('ck1',12);
  dch('ck2'); var c2=g('ck2'); if(c2){ var ar={}; DB.ncr.forEach(function(n){ ar[n.a]=(ar[n.a]||0)+1; }); CH['ck2']=new Chart(c2,{type:'pie',data:{labels:Object.keys(ar).length?Object.keys(ar):['\u05d0\u05d9\u05df'],datasets:[{data:Object.values(ar).length?Object.values(ar):[1],backgroundColor:['rgba(245,197,24,.7)','rgba(255,71,87,.7)','rgba(77,159,255,.7)','rgba(0,200,150,.7)','rgba(255,107,53,.7)'],borderWidth:2,borderColor:'#17171e'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#9090a8',font:{family:'Heebo'},padding:8}}}}}); }
  dch('ck3'); var c3=g('ck3'); if(c3){ var ws2=DB.auds.filter(function(a){ return a.sc; }).slice(-6); CH['ck3']=new Chart(c3,{type:'line',data:{labels:ws2.map(function(a){ return a.n.substring(0,8); }),datasets:[{data:ws2.map(function(a){ return a.sc; }),borderColor:'#4d9fff',backgroundColor:'rgba(77,159,255,.15)',borderWidth:2,fill:true,tension:.4,pointBackgroundColor:'#4d9fff',pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:XA,y:Object.assign({},YA,{min:0,max:100})}}}); }
  dch('ck4'); var c4=g('ck4'); if(c4){ var ct={}; DB.tr.forEach(function(t){ ct[t.c]=(ct[t.c]||0)+1; }); CH['ck4']=new Chart(c4,{type:'bar',data:{labels:Object.keys(ct).length?Object.keys(ct):['\u05d0\u05d9\u05df'],datasets:[{data:Object.values(ct).length?Object.values(ct):[0],backgroundColor:'rgba(0,200,150,.5)',borderColor:'#00c896',borderWidth:2,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:XA,y:Object.assign({},YA,{beginAtZero:true})}}}); }
  dch('ck5'); var c5=g('ck5'); if(c5){ var lo=DB.rsk.filter(function(r){ return r.p*r.sv<4; }).length,me=DB.rsk.filter(function(r){ var v=r.p*r.sv; return v>=4&&v<9; }).length,hi=DB.rsk.filter(function(r){ var v=r.p*r.sv; return v>=9&&v<15; }).length,crit=DB.rsk.filter(function(r){ return r.p*r.sv>=15; }).length; CH['ck5']=new Chart(c5,{type:'doughnut',data:{labels:['\u05e0\u05de\u05d5\u05da','\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9','\u05d2\u05d1\u05d5\u05d4','\u05e7\u05e8\u05d9\u05d8\u05d9'],datasets:[{data:[lo||0,me,hi,crit],backgroundColor:['rgba(46,213,115,.7)','rgba(245,197,24,.7)','rgba(255,165,2,.7)','rgba(255,71,87,.7)'],borderWidth:2,borderColor:'#17171e'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#9090a8',font:{family:'Heebo'},padding:8}}}}}); }
}

// ============================================================
// CHARTS
// ============================================================
function dch(id){ if(CH[id]){ CH[id].destroy(); delete CH[id]; } }
function rIncChart(cid,months){
  dch(cid); var ctx=g(cid); if(!ctx) return;
  var lb=[],dt=[],now=new Date();
  for(var i=months-1;i>=0;i--){
    var d=new Date(now.getFullYear(),now.getMonth()-i,1);
    lb.push(d.toLocaleDateString('he-IL',{month:'short'}));
    dt.push(DB.inc.filter(function(x){ try{ var xd=new Date(x.dt); return xd.getFullYear()===d.getFullYear()&&xd.getMonth()===d.getMonth(); }catch(e){ return false; } }).length);
  }
  CH[cid]=new Chart(ctx,{type:'bar',data:{labels:lb,datasets:[{data:dt,backgroundColor:'rgba(255,71,87,.4)',borderColor:'rgba(255,71,87,.8)',borderWidth:2,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:XA,y:Object.assign({},YA,{beginAtZero:true})}}});
}
function rDocChart(){
  dch('cdo'); var ctx=g('cdo'); if(!ctx) return;
  var a=DB.docs.filter(function(d){ return d.s==='\u05d1\u05ea\u05d5\u05e7\u05e3'; }).length;
  var r=DB.docs.filter(function(d){ return d.s==='\u05d1\u05e1\u05e7\u05d9\u05e8\u05d4'; }).length;
  var c=DB.docs.filter(function(d){ return d.s==='\u05de\u05d1\u05d5\u05d8\u05dc'; }).length;
  CH['cdo']=new Chart(ctx,{type:'doughnut',data:{labels:['\u05d1\u05ea\u05d5\u05e7\u05e3','\u05d1\u05e1\u05e7\u05d9\u05e8\u05d4','\u05de\u05d1\u05d5\u05d8\u05dc'],datasets:[{data:[a||1,r,c],backgroundColor:['rgba(46,213,115,.7)','rgba(245,197,24,.7)','rgba(255,71,87,.7)'],borderColor:['#2ed573','#f5c518','#ff4757'],borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#9090a8',font:{family:'Heebo'},padding:8}}}}});
}

// ============================================================
// PDF & JSON EXPORT
// ============================================================
function expPDF() {
  try {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error('jsPDF missing');
    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pageW = 210, margin = 15, col = pageW - margin * 2;

    // Colors
    var colGray = [80, 80, 80];
    var colDark = [30, 30, 30];
    var colLight = [150, 150, 150];

    // Status map English
    var SMAP = {};
    SMAP['\u05d1\u05ea\u05d5\u05e7\u05e3'] = 'Active';
    SMAP['\u05d4\u05d5\u05e9\u05dc\u05dd'] = 'Completed';
    SMAP['\u05e1\u05d2\u05d5\u05e8'] = 'Closed';
    SMAP['\u05e4\u05ea\u05d5\u05d7'] = 'Open';
    SMAP['\u05d1\u05d8\u05d9\u05e4\u05d5\u05dc'] = 'In Progress';
    SMAP['\u05d1\u05e1\u05e7\u05d9\u05e8\u05d4'] = 'Under Review';
    SMAP['\u05de\u05d1\u05d5\u05d8\u05dc'] = 'Cancelled';
    SMAP['\u05de\u05ea\u05d5\u05db\u05e0\u05df'] = 'Planned';
    SMAP['\u05de\u05de\u05ea\u05d9\u05df \u05dc\u05d0\u05d9\u05e9\u05d5\u05e8'] = 'Pending Approval';
    SMAP['\u05e7\u05dc'] = 'Low';
    SMAP['\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9'] = 'Medium';
    SMAP['\u05d7\u05de\u05d5\u05e8'] = 'High';
    SMAP['\u05e7\u05e8\u05d9\u05d8\u05d9'] = 'Critical';
    SMAP['\u05e0\u05de\u05d5\u05db\u05d4'] = 'Low';
    SMAP['\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9\u05ea'] = 'Medium';
    SMAP['\u05d2\u05d1\u05d5\u05d4\u05d4'] = 'High';
    SMAP['\u05e7\u05e8\u05d9\u05d8\u05d9\u05ea'] = 'Critical';
    function en(v) { return SMAP[v] || (v || '').replace(/[^\x00-\x7F]/g, '?'); }

    var y = 15;
    function chkPage() { if (y > 270) { doc.addPage(); y = 15; } }
    function hline() { doc.setDrawColor(200,200,200); doc.setLineWidth(0.3); doc.line(margin, y, pageW-margin, y); y += 4; }
    function footer() {
      var total = doc.getNumberOfPages();
      for (var p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFontSize(7); doc.setTextColor(colLight[0],colLight[1],colLight[2]);
        doc.text('Tfugen Industries | Safety Manager: Michael Freilich | All Rights Reserved 2025', pageW/2, 290, {align:'center'});
        doc.text('Page ' + p + ' / ' + total, pageW-margin, 290, {align:'right'});
      }
    }

    // HEADER
    doc.setFillColor(30,30,30); doc.rect(0,0,pageW,42,'F');
    doc.setFontSize(16); doc.setTextColor(245,197,24);
    doc.text('Safety & Environment Management', pageW/2, 14, {align:'center'});
    doc.setFontSize(10); doc.setTextColor(220,220,220);
    doc.text('Tfugen Industries', pageW/2, 21, {align:'center'});
    doc.setFontSize(8); doc.setTextColor(160,160,160);
    doc.text('Safety Manager: Michael Freilich | All Rights Reserved 2025', pageW/2, 28, {align:'center'});
    doc.text('Report Date: ' + new Date().toLocaleDateString('en-GB'), pageW/2, 34, {align:'center'});
    y = 50;

    // KPI BOX
    doc.setFillColor(245,245,250); doc.roundedRect(margin, y, col, 32, 3, 3, 'F');
    doc.setFontSize(9); doc.setTextColor(colDark[0],colDark[1],colDark[2]);
    var kx = [margin+5, margin+50, margin+95, margin+140];
    var ky = y + 10;
    var lostDays = DB.inc.reduce(function(s,i){ return s+i.dy; }, 0);
    var openCapa = DB.ncr.filter(function(n){ return n.s !== '\u05e1\u05d2\u05d5\u05e8'; }).length;
    var critRsk = DB.rsk.filter(function(r){ return r.p*r.sv >= 15; }).length;
    var validTr = DB.tr.filter(function(t){ return t.s==='\u05d4\u05d5\u05e9\u05dc\u05dd' && du(t.e)>=0; }).length;
    doc.setFontSize(14); doc.setTextColor(245,197,24);
    doc.text(String(DB.inc.length), kx[0], ky, {align:'left'});
    doc.text(String(lostDays), kx[1], ky, {align:'left'});
    doc.text(String(openCapa), kx[2], ky, {align:'left'});
    doc.text(String(critRsk), kx[3], ky, {align:'left'});
    doc.setFontSize(7); doc.setTextColor(colLight[0],colLight[1],colLight[2]);
    doc.text('Incidents', kx[0], ky+5, {align:'left'});
    doc.text('Lost Days', kx[1], ky+5, {align:'left'});
    doc.text('Open CAPA', kx[2], ky+5, {align:'left'});
    doc.text('Critical Risks', kx[3], ky+5, {align:'left'});
    ky = y + 22;
    doc.setFontSize(14); doc.setTextColor(46,213,115);
    doc.text(String(DB.docs.length), kx[0], ky, {align:'left'});
    doc.text(String(validTr), kx[1], ky, {align:'left'});
    doc.text(String(DB.emp.length), kx[2], ky, {align:'left'});
    doc.text(String(DB.files.length), kx[3], ky, {align:'left'});
    doc.setFontSize(7); doc.setTextColor(colLight[0],colLight[1],colLight[2]);
    doc.text('ISO Docs', kx[0], ky+5, {align:'left'});
    doc.text('Valid Training', kx[1], ky+5, {align:'left'});
    doc.text('Employees', kx[2], ky+5, {align:'left'});
    doc.text('Files', kx[3], ky+5, {align:'left'});
    y += 40;

    // SECTION HELPER
    function section(title, cols, rows) {
      chkPage();
      doc.setFillColor(40,40,55); doc.rect(margin, y, col, 7, 'F');
      doc.setFontSize(9); doc.setTextColor(245,197,24);
      doc.text(title, margin+3, y+5);
      y += 11;
      if (!rows.length) {
        doc.setFontSize(8); doc.setTextColor(colLight[0],colLight[1],colLight[2]);
        doc.text('  No records', margin+3, y); y += 8; return;
      }
      var cw = col / cols.length;
      // Header row
      doc.setFillColor(60,60,80);
      doc.rect(margin, y, col, 6, 'F');
      doc.setFontSize(7); doc.setTextColor(200,200,200);
      cols.forEach(function(c, i) { doc.text(c, margin + i*cw + 2, y+4); });
      y += 7;
      // Data rows
      doc.setFontSize(7.5); doc.setTextColor(colDark[0],colDark[1],colDark[2]);
      rows.slice(0,30).forEach(function(row, ri) {
        chkPage();
        if (ri % 2 === 0) { doc.setFillColor(248,248,252); doc.rect(margin, y, col, 5.5, 'F'); }
        row.forEach(function(cell, i) {
          var txt = String(cell || '').substring(0, Math.floor(cw/1.8));
          doc.text(txt, margin + i*cw + 2, y+4);
        });
        y += 5.5;
      });
      y += 6;
    }

    // SECTIONS
    section('ISO Documents (' + DB.docs.length + ')',
      ['Name', 'Category', 'Version', 'Owner', 'Expires', 'Status'],
      DB.docs.map(function(d){ return [d.n, d.c, 'v'+(d.v||'1'), d.o||'-', d.e||'-', en(d.s)]; }));

    section('Audits (' + DB.auds.length + ')',
      ['Subject', 'Auditor', 'Area', 'Date', 'Findings', 'Score', 'Status'],
      DB.auds.map(function(a){ return [a.n, a.a||'-', a.r, a.d||'-', a.f||0, a.sc?a.sc+'%':'-', en(a.s)]; }));

    section('Incidents (' + DB.inc.length + ')',
      ['Date', 'Description', 'Type', 'Severity', 'Lost Days', 'Status'],
      DB.inc.map(function(i){ return [(i.dt||'').substring(0,10), (i.d||'').substring(0,25), en(i.ty), en(i.sv), i.dy||0, en(i.s)]; }));

    section('NCR / CAPA (' + DB.ncr.length + ')',
      ['Number', 'Description', 'Priority', 'Owner', 'Due Date', 'Status'],
      DB.ncr.map(function(n){ return [n.num||'-', (n.d||'').substring(0,25), en(n.p), n.o||'-', n.u||'-', en(n.s)]; }));

    section('Training (' + DB.tr.length + ')',
      ['Employee', 'Training', 'Category', 'Date', 'Expires', 'Signed', 'Status'],
      DB.tr.map(function(t){ return [t.w, (t.n||'').substring(0,18), t.c, t.d||'-', t.e||'-', t.sig?'YES':'NO', en(t.s)]; }));

    section('Risks (' + DB.rsk.length + ')',
      ['Risk', 'Area', 'P', 'S', 'RPN', 'Level', 'Owner'],
      DB.rsk.map(function(r){ var rpn=r.p*r.sv; var lv=rpn>=15?'CRITICAL':rpn>=9?'HIGH':rpn>=4?'MEDIUM':'LOW'; return [(r.d||'').substring(0,22), r.a, r.p, r.sv, rpn, lv, r.o||'-']; }));

    section('Employees (' + DB.emp.length + ')',
      ['Name', 'Role', 'Department', 'Start Date', 'Phone'],
      DB.emp.map(function(e){ return [e.n, e.r||'-', e.dep||'-', e.s||'-', e.ph||'-']; }));

    section('Uploaded Files (' + DB.files.length + ')',
      ['File Name', 'Size', 'Module', 'Upload Date'],
      DB.files.map(function(f){ var m={doc:'ISO Doc',aud:'Audit',inc:'Incident',ncr:'CAPA',rsk:'Risk',tr:'Training',gen:'General'}; return [(f.name||'').substring(0,30), fmtSz(f.size), m[f.ctx]||f.ctx, new Date(f.ts).toLocaleDateString('en-GB')]; }));

    footer();

    // Download \u2014 works on iOS Safari, Android, Chrome, Firefox
    var fname = 'Tfugen-Safety-' + new Date().toISOString().split('T')[0] + '.pdf';
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      // iOS Safari: open data URI in new tab &#8594; user taps Share &#8594; Save to Files
      var dataUri = doc.output('datauristring');
      var w = window.open(dataUri, '_blank');
      if (!w) {
        // If popup blocked, redirect current page
        window.location.href = dataUri;
      }
      toast('\u05d4-PDF \u05e0\u05e4\u05ea\u05d7 \u2014 \u05dc\u05d7\u05e5 Share \u05d5\u05e9\u05de\u05d5\u05e8 \u05d0\u05d5 \u05d4\u05d3\u05e4\u05e1', 'ok');
    } else {
      // Desktop / Android Chrome: direct download
      var blob = doc.output('blob');
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click();
      setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 3000);
      toast('PDF \u05de\u05d5\u05e8\u05d9\u05d3 &#8595;', 'ok');
    }

  } catch(err) {
    console.error('PDF error:', err);
    // Fallback: open print window
    var win = window.open('', '_blank');
    if (!win) { toast('\u05d0\u05e4\u05e9\u05e8 \u05d7\u05dc\u05d5\u05e0\u05d5\u05ea \u05e7\u05d5\u05e4\u05e6\u05d9\u05dd \u05d1\u05d3\u05e4\u05d3\u05e4\u05df', 'rd'); return; }
    var rows = '<tr><td>\u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd</td><td>'+DB.inc.length+'</td></tr>'
      + '<tr><td>\u05d9\u05de\u05d9 \u05d0\u05d1\u05d3\u05df</td><td>'+DB.inc.reduce(function(s,i){return s+i.dy;},0)+'</td></tr>'
      + '<tr><td>\u05de\u05e1\u05de\u05db\u05d9 ISO</td><td>'+DB.docs.length+'</td></tr>'
      + '<tr><td>\u05d1\u05d9\u05e7\u05d5\u05e8\u05d5\u05ea</td><td>'+DB.auds.length+'</td></tr>'
      + '<tr><td>CAPA \u05e4\u05ea\u05d5\u05d7\u05d5\u05ea</td><td>'+DB.ncr.filter(function(n){return n.s!=='\u05e1\u05d2\u05d5\u05e8';}).length+'</td></tr>'
      + '<tr><td>\u05e1\u05d9\u05db\u05d5\u05e0\u05d9\u05dd \u05e7\u05e8\u05d9\u05d8\u05d9\u05d9\u05dd</td><td>'+DB.rsk.filter(function(r){return r.p*r.sv>=15;}).length+'</td></tr>'
      + '<tr><td>\u05d4\u05d3\u05e8\u05db\u05d5\u05ea</td><td>'+DB.tr.length+'</td></tr>'
      + '<tr><td>\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd</td><td>'+DB.emp.length+'</td></tr>'
      + '<tr><td>\u05e7\u05d1\u05e6\u05d9\u05dd</td><td>'+DB.files.length+'</td></tr>';
    win.document.write('<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>\u05d3\u05d5\u05d7 \u05ea\u05e4\u05d5\u05d2\u05df</title>'
      + '<style>body{font-family:Arial;padding:20px;direction:rtl}h1{color:#333}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px;text-align:right}th{background:#f0f0f0}.ft{margin-top:20px;font-size:11px;color:#777;text-align:center}button{background:#f5c518;border:none;padding:8px 20px;font-size:14px;cursor:pointer;border-radius:6px;margin-bottom:16px}@media print{button{display:none}}</style>'
      + '</head><body>'
      + '<h1>\u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d5\u05d0\u05d9\u05db\u05d5\u05ea \u05d4\u05e1\u05d1\u05d9\u05d1\u05d4 \u2013 \u05ea\u05e2\u05e9\u05d9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df</h1>'
      + '<p>\u05de\u05e0\u05d4\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea: <strong>\u05de\u05d9\u05db\u05d0\u05dc \u05e4\u05e8\u05d9\u05d9\u05dc\u05d9\u05db\u05d4</strong> | '+new Date().toLocaleDateString('he-IL')+'</p>'
      + '<br><button onclick="window.print()">\u25c4 \u05d4\u05d3\u05e4\u05e1 / \u05e9\u05de\u05d5\u05e8 \u05db\u05d5-PDF</button>'
      + '<table><thead><tr><th>\u05de\u05d3\u05d3</th><th>\u05e2\u05e8\u05da</th></tr></thead><tbody>'+rows+'</tbody></table>'
      + '<div class="ft">\u00a9 \u05db\u05dc \u05d4\u05d6\u05db\u05d5\u05d9\u05d5\u05ea \u05e9\u05de\u05d5\u05e8\u05d5\u05ea | \u05de\u05d9\u05db\u05d0\u05dc \u05e4\u05e8\u05d9\u05d9\u05dc\u05d9\u05db\u05d4 \u05de\u05e0\u05d4\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea | \u05ea\u05e2\u05e9\u05d9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df 2025</div>'
      + '</body></html>');
    win.document.close();
    toast('\u05d3\u05d5\u05d7 \u05e0\u05e4\u05ea\u05d7 \u2013 \u05dc\u05d7\u05e5 \u05d4\u05d3\u05e4\u05e1', 'ok');
  }
}


function xp(){
  var d={generated:new Date().toLocaleString('he-IL'),docs:DB.docs.length,auds:DB.auds.length,inc:DB.inc.length,ncr:DB.ncr.length,tr:DB.tr.length,rsk:DB.rsk.length,emp:DB.emp.length,files:DB.files.length};
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));
  a.download='tfgn-'+new Date().toISOString().split('T')[0]+'.json';
  a.click();
}

// ============================================================
// INIT
// ============================================================
ldb();
var clg=g('clr-lg');
if(clg) clg.onclick=function(){ if(confirm('\u05dc\u05e0\u05e7\u05d5\u05ea?')){ DB.hist=[]; sdb(); rLg(); } };
g('dd') && (g('dd').textContent=new Date().toLocaleDateString('he-IL',{weekday:'long',year:'numeric',month:'long',day:'numeric'}));
g('madd') && (g('madd').style.display='none');
var mTr=g('m-tr');
if(mTr){ new MutationObserver(function(ml){ ml.forEach(function(m){ if(m.attributeName==='class'&&mTr.classList.contains('on')) setTimeout(initSig,120); }); }).observe(mTr,{attributes:true}); }
rDash();
checkAuth();
