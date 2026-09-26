// Visual audit of every page, row menu and modal at phone width.
//
// Michael, 2026-09-26: «ראינו שיש תקלות. מחקר מאוד מקצועי להכל, ויזואלי, ואחרי
// תיקון וידוי ויזואלי». The trigger was a row menu that opened downward from
// the last card and put «מחק דיווח» below the screen edge (PR #837). This
// walks the real index.html in Chromium at 390x844 (Michael's phone) and
// 320x568 (the narrowest still in use), in two data states -- the live one
// (most tables are empty today) and a seeded one (three rows per table, long
// Hebrew text) -- and measures, for every page:
//
//   - horizontal overflow of the document and which elements cause it
//   - text that is cut without an ellipsis
//   - buttons covered by a fixed element (the ✨ report button, the bottom
//     nav, the top bar) at their natural scroll position
//   - touch targets under 40px
//   - every ⋯ row menu: opened, measured inside the viewport
//   - every modal reachable from the page: opened, measured, closed
//   - page errors thrown while rendering
//
// Screenshots of every page and every opened menu/modal go to the output
// directory, and findings.json next to them. The console summary lists the
// findings; the exit code is 1 when any finding is a defect.
//
//   node tests/harness/visual-audit.js [outDir] [--width=390] [--state=seeded|empty|both]
const path = require('path');
const fs = require('fs');
const pw = require('playwright');
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const argv = process.argv.slice(2);
const OUT = argv.find((a) => !a.startsWith('--')) || path.join(require('os').tmpdir(), 'tfgn-audit');
const WIDTHS = (argv.find((a) => a.startsWith('--width=')) || '--width=390,320').slice(8).split(',').map(Number);
const STATE = (argv.find((a) => a.startsWith('--state=')) || '--state=both').slice(8);
const ONLY = (argv.find((a) => a.startsWith('--pages=')) || '').slice(8);
fs.mkdirSync(OUT, { recursive: true });

const PAGES = ['dash', 'tasks', 'cal', 'mr', 'exp', 'nm', 'inc', 'round', 'ncr', 'eqi', 'toolbox', 'docs', 'aud', 'tr',
  'hearing', 'leg', 'rsk', 'ptw', 'ppe', 'ctr', 'wst', 'hzm', 'env', 'easp', 'emp', 'drl', 'ins', 'lg', 'users', 'audit',
  'agents', 'loc', 'prj', 'itp', 'itype', 'trustees'];

const findings = [];
const note = (sev, where, what, detail) => {
  findings.push({ sev, where, what, detail });
  console.log('  ' + (sev === 'defect' ? '✗' : sev === 'warn' ? '!' : '·') + ' [' + where + '] ' + what + (detail !== undefined ? '  -> ' + JSON.stringify(detail).slice(0, 300) : ''));
};

// Seeded rows: three per table, with the long Hebrew a real record carries.
const SEED = `(function(){
  var L='תיאור ארוך במיוחד שנכתב כדי לבדוק איך שורה ארוכה מתנהגת בטלפון צר, כולל מספרים 12345 ואנגלית ABC';
  var today=new Date(), iso=function(days){var d=new Date(today.getTime()+days*864e5);return d.toISOString().slice(0,10);};
  var rows=function(mk){return [mk(0),mk(1),mk(2)];};
  var S={
    docs:rows(function(i){return {id:'seed_docs'+i,n:'נוהל בטיחות '+(i+1)+' '+L,c:'נהלים',v:'1.'+i,o:'מיכאל',u:iso(-30),e:iso([-10,20,200][i]),s:'בתוקף',i:iso(-400),nt:L,file_url:null};}),
    auds:rows(function(i){return {id:'seed_auds'+i,n:'מבדק פנימי '+L,a:'מבקר '+i,r:'ISO 45001',d:iso(-30*i),f:L,sc:80+i,s:['פתוח','סגור','פתוח'][i],f2:L,sm:L};}),
    ncr:rows(function(i){return {id:'seed_ncr'+i,num:'NCR-2026-00'+i,d:iso(-20*i),sd:iso(-20*i),a:'ייצור טוגנים',p:['גבוה','נמוך','בינוני'][i],o:'מנהל אחזקה',f:L,u:'מיכאל',s:['פתוח','סגור','בטיפול'][i],c:L,category:'בטיחות',cd:i===1?iso(-2):null,loc:'חומר גלם',root_cause:L,immediate:L,notes:L,rc:L,ts:iso(-20*i),sens:false};}),
    inc:rows(function(i){return {id:'seed_inc'+i,d:iso(-i),dt:iso(-i),ty:'תאונת עבודה',sv:['קל','בינוני','חמור'][i],l:'ייצור טוגנים',w:'עובד '+i,dy:i,s:['פתוח','סגור','פתוח'][i],r:L,p:L,file_url:null};}),
    tr:rows(function(i){return {id:'seed_tr'+i,w:'עובד '+i,n:'הדרכת בטיחות '+L,c:'מדריך חיצוני',tr_name:'הדרכת בטיחות',d:iso(-300),e:iso([-5,15,300][i]),sc:'90',s:'הושלם',sig:null,file_url:null};}),
    rsk:rows(function(i){return {id:'seed_rsk'+i,d:'סיכון '+L,a:'ייצור טוגנים',o:'מנהל ייצור',p:i+1,sv:[5,3,2][i],ct:L,ac:L,last_review:iso(-100)};}),
    ptw:rows(function(i){return {id:'seed_ptw'+i,num:'PTW-'+i,con:'קבלן חיצוני בע"מ',sup:'מפקח',ph:'0501234567',wkr:'עובד א, עובד ב, עובד ג',area:'תשתיות',dep:'אחזקה',ds:iso(0),de:iso(1),ts:'08:00',te:'17:00',types:'עבודה בגובה, אש',safety:L,desc:L,s:'פתוח',sg1n:'מיכאל',sg1d:iso(0)};}),
    ppe:rows(function(i){return {id:'seed_ppe'+i,ty:'קסדה '+L,w:'עובד '+i,m:'דגם X',d:iso(-100),e:iso([-1,25,400][i]),c:'10'};}),
    med:rows(function(i){return {id:'seed_med'+i,w:'עובד '+i,ty:'שמיעה',d:iso(-200),e:iso([-3,12,250][i]),r:'תקין',n:L};}),
    ins:rows(function(i){return {id:'seed_ins'+i,d:iso(-10*i),a:'חומר גלם',i:'מיכאל',sc:90-i,fn:L,ac:L,s:['פתוח','סגור','פתוח'][i]};}),
    drl:rows(function(i){return {id:'seed_drl'+i,ty:'פינוי',d:iso(-10*i),p:35,dur:'12 דק',sc:'טוב',n:L};}),
    ctr:rows(function(i){return {id:'seed_ctr'+i,n:'קבלן '+i+' '+L,ty:'חשמל',c:'איש קשר',ph:'0501234567',e:iso([-4,18,180][i]),tr:'כן',s:'פעיל',file_url:null};}),
    wst:rows(function(i){return {id:'seed_wst'+i,d:iso(-i),ty:'שמן משומש',q:120,c:'13 02 05',h:'כן',t:'GNG אנרגיה ירוקה'};}),
    hzm:rows(function(i){return {id:'seed_hzm'+i,n:'אמוניה '+L,un:'UN1005',hs:'רעיל',q:'500 ק"ג',loc:'מגדל קירור',ms:'כן',em:L};}),
    env:rows(function(i){return {id:'seed_env'+i,d:iso(-i),ty:'שפכים COD',me:'מעבדה',r:900+i,u:'mg/l',lim:800,s:'חריגה'};}),
    leg:rows(function(i){return {id:'seed_leg'+i,s:'תקנות הבטיחות '+L,d:iso(-500),a:'משרד העבודה',c:['עומד','לא עומד','חלקי'][i],u:iso(-30),o:'מיכאל',topic:'בטיחות',law_type:'תקנה',law_num:'ק"ת 1234',summary:L,last_review:iso(-30)};}),
    equip_inspections:rows(function(i){return {id:'seed_eqi'+i,code:'EQ-'+i,n:'מלגזה '+L,vendor:'בודק מוסמך',loc:'חומר גלם',d:iso(-300),e:iso([-7,14,365][i]),s:'תקין',notes:L,photo_url:null,inspector:'בודק',category:'ציוד הרמה'};}),
    near_miss:rows(function(i){return {id:'seed_nm'+i,d:iso(-i),t:'10:30',descr:L,area:'ייצור טוגנים',rep:'מוסא',sev:['נמוך','בינוני','גבוה'][i],typ:'החלקה',s:['פתוח','בטיפול','סגור'][i],notes:L,photo_url:null,ts:new Date(today.getTime()-i*864e5).toISOString()};}),
    rounds:rows(function(i){return {id:'seed_round'+i,d:iso(-i),inspector:'מיכאל',fire:true,corridors:i!==1,ppe:true,samples:false,chemicals:true,firstaid:true,notes:L,s:'בוצע',ts:new Date(today.getTime()-i*864e5).toISOString()};}),
    tasks:rows(function(i){return {id:'seed_task'+i,title:'משימה '+L,assignee:'מיכאל',due:iso([-2,5,30][i]),status:['פתוח','פתוח','סגור'][i],priority:['גבוה','בינוני','נמוך'][i],source_table:'near_miss',source_id:'seed_nm0',notes:L,ts:new Date().toISOString()};}),
    toolbox:rows(function(i){return {id:'seed_tb'+i,d:iso(-7*i),topic:'ריענון בטיחות שבועי '+L,presenter:'נועם היקינד',attendees:'12',s:'נמסרה',notes:L,file_url:null,dep:'טוגנים'};}),
    hearing_tests:rows(function(i){return {id:'seed_hear'+i,emp_name:'עובד '+i+' '+L,emp_id:'10'+i,dob:'1980-01-01',age:46,gender:'ז',role:'מפעיל',dept:'ייצור',category:'A',year:2026,notes:L,test_date:iso(-100*i),inspector:'מכון',e:iso([-9,60,300][i])};}),
    mgmt_reviews:rows(function(i){return {id:'seed_mr'+i,kind:'שנתית',period:'2026',content:L,kpis:{},created_by:'מיכאל',ts:new Date().toISOString()};}),
    projects:rows(function(i){return {id:'seed_prj'+i,name:'פרויקט '+L,description:L,start_date:iso(-30),end_date:iso(60),status:'פעיל',ts:new Date().toISOString()};}),
    trustee_reports:rows(function(i){return {id:'seed_tru'+i,u:['מוסא','לב','גלינה'][i],m:iso(0).slice(0,7),t:i+1,d:iso(-i),loc:'חומר גלם · רחבת חדרי קירור 17 ו18 '+L,ok:i===2,f:i===2?null:'פנסי אזהרה מהבהב לא עובדים + שילוט גובה מקסימלי '+L,photo_url:null,s:['פתוח','נסגר','פתוח'][i],mgr_note:i?null:'נותב לאחזקה עד 30/09/2026 (מייל 23/09/2026)',ts:new Date(today.getTime()-i*864e5).toISOString(),tour:'seed_tour'+i,notified_at:null,verified_by:null};})
  };
  Object.keys(S).forEach(function(t){DB[t]=(DB[t]&&DB[t].length)?DB[t]:S[t];});
  if(!DB.emp||!DB.emp.length)DB.emp=[{id:'e1',n:'מיכאל פרייליך',dep:'מערך תומך',ph:'0547940073',ext_id:'599',em:'sviva@tapugan.co.il'},{id:'e2',n:'נועם היקינד',dep:'יצור',ph:'0524282390',ext_id:'654'},{id:'e3',n:'מרדכייב לואיזה',dep:'יצור',ext_id:'112'}];
  if(!DB.trustees||!DB.trustees.length)DB.trustees=[{id:'tru_01',n:'לב',dep:'ייצור ואריזה',active:true},{id:'tru_02',n:'גלינה',dep:'מעבדה',active:true},{id:'tru_05',n:'מוסא',dep:'חומר גלם',active:true},{id:'tru_06',n:'רנט',dep:'מט"ש וסביבה',active:true}];
  if(!DB.locations||!DB.locations.length)DB.locations=[{id:'LOC-001',name:'ייצור טוגנים',level:1},{id:'LOC-006',name:'חומר גלם',level:1},{id:'LOC-008',name:'תוצ"ג',level:1},{id:'LOC-010',name:'מעבדה',level:1}];
  if(!DB.inspection_types||!DB.inspection_types.length)DB.inspection_types=[{id:'ITP-FIRE-EXT',name:'בדיקת מטפי כיבוי אש',recur_count:1,recur_unit:'year',responsible:'נאמן בטיחות',active:true},{id:'ITP-FORKLIFT',name:'בדיקה שנתית מלגזות',recur_count:1,recur_unit:'year',responsible:'בודק מוסמך',active:true}];
  if(!DB.issue_types||!DB.issue_types.length)DB.issue_types=[{id:'IT-ENV',name:'אי-התאמות סביבתיות',level:1,category:'איכות סביבה'},{id:'IT-SAFETY-SLIP',name:'החלקות, מעידות ונפילות',parent_id:'IT-SAFETY',level:2,category:'בטיחות'}];
  if(!DB.trustee_tasks||!DB.trustee_tasks.length)DB.trustee_tasks=[{id:'tsk_01',n:1,icon:'🔍',t:'סיור מפגעים באזור',how:L,active:true},{id:'tsk_02',n:2,icon:'🚿',t:'מקלחות חירום ושטיפות עיניים',how:L,active:true},{id:'tsk_03',n:3,icon:'🚪',t:'דרכי מילוט ויציאות חירום',how:L,active:true},{id:'tsk_04',n:4,icon:'🪜',t:'תקינות סולמות וגישה לגובה',how:L,active:true}];
  if(!DB.notifications_log||!DB.notifications_log.length){DB.notifications_log=[];for(var i=0;i<5;i++)DB.notifications_log.push({id:'n'+i,ts:new Date(today.getTime()-i*36e5).toISOString(),event:'trustee_hazard',event_type:'trustee_hazard',channel:i%2?'whatsapp':'email',status:'sent',to:'0547940073',title:'מיכאל — תקינות סולמות וגישה לגובה: '+L,payload:{title:'מיכאל — תקינות סולמות: '+L,detail:'sent'}});}
  if(!DB.env_aspects||!DB.env_aspects.length)DB.env_aspects=[{id:'ea_1',aspect:'חומרים מסוכנים',activity:'מגדל קירור אמוניה',impact:L,controls:L,owner:'מנהל איכות סביבה',review_date:iso(90),lifecycle:'ייצור',p_curr:1,sv_curr:4,p_pot:1,sv_pot:4,status:'קיים'},{id:'ea_2',aspect:'זיהום מקורות מים/קרקע',activity:'בור שומן תת-קרקעי',impact:L,controls:L,owner:'מנהל איכות סביבה',review_date:iso(-10),lifecycle:'ייצור',p_curr:2,sv_curr:2,p_pot:2,sv_pot:2,status:'מבוצע'}];
  if(!DB.app_users||!DB.app_users.length)DB.app_users=[{id:'u1',username:'admin',name:'מיכאל פרייליך',role:'אדמין',email:'sviva@tapugan.co.il'},{id:'u2',username:'noam',name:'נועם היקינד',role:'מנהל',email:'prod@tapugan.co.il'},{id:'u3',username:'viewer',name:'צופה '+L,role:'צופה'}];
  if(!DB.audit_log||!DB.audit_log.length){DB.audit_log=[];for(var j=0;j<4;j++)DB.audit_log.push({id:j,ts:new Date(today.getTime()-j*36e5).toISOString(),user_email:'admin@tfugen.local',table_name:'trustee_reports',record_id:'seed_tru0',op:['ins','upd','del','upd'][j],title:L});}
  if(!DB.record_history||!DB.record_history.length)DB.record_history=[];
  try{sdb();}catch(e){}
})();`;

// In-page measurement of the current page. Returns a plain object.
const MEASURE = `(function(pageId){
  var vw=window.innerWidth, vh=window.innerHeight, out={};
  var pg=document.getElementById('pg-'+pageId);
  var vis=function(el){var r=el.getBoundingClientRect();if(!r.width||!r.height)return false;var cs=getComputedStyle(el);return cs.visibility!=='hidden'&&cs.display!=='none'&&cs.opacity!=='0';};
  var desc=function(el){var t=el.tagName.toLowerCase();if(el.id)t+='#'+el.id;else if(el.className&&typeof el.className==='string')t+='.'+el.className.trim().split(/\\s+/).slice(0,2).join('.');var tx=(el.innerText||el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,40);return t+(tx?' «'+tx+'»':'');};
  // 1. document overflow + offenders
  out.scrollWidth=document.documentElement.scrollWidth; out.vw=vw;
  var offenders=[];
  if(pg){Array.prototype.forEach.call(pg.querySelectorAll('*'),function(el){if(offenders.length>=8)return;if(!vis(el))return;var cs=getComputedStyle(el);if(cs.position==='fixed')return;var r=el.getBoundingClientRect();if(r.right>vw+1||r.left<-1){var p=el.parentElement;if(p&&(getComputedStyle(p).overflowX==='auto'||getComputedStyle(p).overflowX==='scroll'||getComputedStyle(p).overflowX==='hidden'))return;offenders.push({el:desc(el),left:Math.round(r.left),right:Math.round(r.right),w:Math.round(r.width)});}});}
  out.offenders=offenders;
  // 2. text cut without an ellipsis (only leaf-ish elements with text)
  var cut=[], ell=0;
  if(pg){Array.prototype.forEach.call(pg.querySelectorAll('*'),function(el){if(cut.length>=8)return;if(!vis(el))return;if(el.children.length>3)return;var cs=getComputedStyle(el);if(cs.overflowX!=='hidden'&&cs.overflow!=='hidden')return;if(el.scrollWidth>el.clientWidth+2){var tx=(el.innerText||'').trim();if(!tx)return;if(cs.textOverflow==='ellipsis'){ell++;return;}var er=el.getBoundingClientRect(),real=false;if(!el.children.length)real=true;else Array.prototype.forEach.call(el.children,function(k){var kr=k.getBoundingClientRect();if(kr.width&&(kr.right>er.right+2||kr.left<er.left-2))real=true;});if(!real)return;cut.push({el:desc(el),scroll:el.scrollWidth,client:el.clientWidth});}});}
  out.cut=cut; out.ellipsis=ell;
  // 3. controls: size + covered by a fixed element at natural scroll position
  var small=[], covered=[], ctrls=[];
  if(pg){ctrls=Array.prototype.filter.call(pg.querySelectorAll('button, a[onclick], [role=button], input[type=checkbox], select'),vis);}
  out.controls=ctrls.length;
  ctrls.forEach(function(el){var r=el.getBoundingClientRect();if(el.tagName!=='SELECT'&&el.type!=='checkbox'&&(r.width<40||r.height<40)&&small.length<8)small.push({el:desc(el),w:Math.round(r.width),h:Math.round(r.height)});});
  out.small=small; out.smallCount=ctrls.filter(function(el){var r=el.getBoundingClientRect();return el.tagName!=='SELECT'&&el.type!=='checkbox'&&(r.width<40||r.height<40);}).length;
  // Covered: a control the user can never scroll clear of a fixed element.
  // Mid-page a thumb just scrolls on, so only the two ends count: at the very
  // top (behind the top bar) and at the very bottom (behind the ✨ button or
  // the bottom nav, when the page's bottom padding is too small).
  var main=document.querySelector('.main');
  // At scroll 0 a control behind the top bar can never be reached; one behind
  // the bottom elements is stuck only when the page is too short to scroll it
  // clear (maxScroll under the height of that band). At max scroll anything
  // still behind the bottom band is stuck; what sits behind the top bar there
  // is just earlier content that scrolled past, so it is not counted.
  var maxScroll=main?(main.scrollHeight-main.clientHeight):(document.documentElement.scrollHeight-vh);
  out.maxScroll=maxScroll;
  var probe=function(where){ctrls.forEach(function(el){if(covered.length>=8)return;var r=el.getBoundingClientRect();var cx=r.left+r.width/2, cy=r.top+r.height/2;if(cx<0||cx>vw||cy<0||cy>vh)return;var top=document.elementFromPoint(cx,cy);if(!top)return;if(top===el||el.contains(top))return;var fixed=top;while(fixed&&fixed!==document.body&&getComputedStyle(fixed).position!=='fixed')fixed=fixed.parentElement;if(!fixed||fixed===document.body)return;var lowBand=cy>vh-150, highBand=cy<100;if(where==='top'&&!(highBand||(lowBand&&maxScroll<120)))return;if(where==='bottom'&&!lowBand)return;covered.push({el:desc(el),by:desc(fixed),at:where,cy:Math.round(cy),maxScroll:maxScroll});});};
  if(main){main.scrollTop=0;}window.scrollTo(0,0);probe('top');
  if(main){main.scrollTop=main.scrollHeight;}else window.scrollTo(0,document.documentElement.scrollHeight);probe('bottom');
  out.covered=covered;
  if(main)main.scrollTop=0; window.scrollTo(0,0);
  // 4. menu buttons and modal openers reachable from this page (+ topbar)
  var menuBtns=[], modals={};
  var scope=[pg,document.querySelector('.topbar')].filter(Boolean);
  scope.forEach(function(root){Array.prototype.forEach.call(root.querySelectorAll('[onclick]'),function(el){if(!vis(el))return;var oc=el.getAttribute('onclick')||'';if(/Menu\\(/.test(oc)&&!/closeMenu|goPage/.test(oc)){el.setAttribute('data-audit-idx',menuBtns.length);menuBtns.push({idx:menuBtns.length,el:desc(el),oc:oc.slice(0,80)});}var m=oc.match(/openModal\\(['"]([^'"]+)['"]/);if(m&&document.getElementById(m[1]))modals[m[1]]=desc(el);});});
  out.menuBtns=menuBtns; out.modals=Object.keys(modals).map(function(k){return {id:k,from:modals[k]};});
  // 5. glyphs that are not emoji-presentation by default (U+1F5xx block etc.)
  var glyphs={};
  if(pg){var walker=document.createTreeWalker(pg,NodeFilter.SHOW_TEXT);var n;while((n=walker.nextNode())){var s=n.nodeValue;for(var i=0;i<s.length;i++){var c=s.codePointAt(i);if(c>0xffff)i++;if((c>=0x1F5A0&&c<=0x1F5FF)||(c>=0x1F320&&c<=0x1F32C)||(c>=0x2190&&c<=0x21FF&&c!==0x21a9&&c!==0x2192&&c!==0x2190)||c===0x25AF||c===0x25AE){var k=c.toString(16);glyphs[k]=(glyphs[k]||0)+1;}}}}
  out.glyphs=glyphs;
  return out;
})`;

const MEASURE_MENU = `(function(){
  var vw=window.innerWidth,vh=window.innerHeight;
  var cands=Array.prototype.filter.call(document.body.children,function(d){var cs=getComputedStyle(d);return d.tagName==='DIV'&&cs.position==='fixed'&&parseInt(cs.zIndex||0,10)>=999&&d.getBoundingClientRect().height>0&&d.querySelectorAll('button').length>0&&!/^(m-|ov-)/.test(d.id||'');});
  var m=cands[cands.length-1]; if(!m)return null;
  var r=m.getBoundingClientRect();
  var mcs=getComputedStyle(m),scrollable=/auto|scroll/.test(mcs.overflowY)&&m.scrollHeight>m.clientHeight+1;
  // Items past the menu's own bottom are reachable when the menu scrolls inside itself; only an unscrollable menu loses them.
  var labels=Array.prototype.map.call(m.querySelectorAll('button'),function(b){var br=b.getBoundingClientRect();var sp=b.querySelector('span:last-child')||b;var inside=br.left>=0&&br.right<=vw&&br.top>=0&&br.bottom<=vh;if(!inside&&scrollable&&br.top>=r.top&&br.left>=0&&br.right<=vw)inside=true;return {t:(b.innerText||'').trim().slice(0,40),inside:inside,cut:sp.scrollWidth>sp.clientWidth+2};});
  return {id:m.id,scrollable:scrollable,top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right),vw:vw,vh:vh,items:labels.length,outside:labels.filter(function(l){return !l.inside;}).map(function(l){return l.t;}),cut:labels.filter(function(l){return l.cut;}).map(function(l){return l.t;})};
})`;

const MEASURE_MODAL = `(function(id){
  var vw=window.innerWidth,vh=window.innerHeight;
  var m=document.getElementById(id); if(!m)return null;
  var cs=getComputedStyle(m); if(cs.display==='none')return {id:id,notShown:true};
  var r=m.getBoundingClientRect();
  var wide=[];
  Array.prototype.forEach.call(m.querySelectorAll('*'),function(el){if(wide.length>=6)return;var er=el.getBoundingClientRect();if(!er.width)return;if(getComputedStyle(el).position==='fixed')return;if(er.right>vw+1||er.left<-1){var p=el.parentElement;if(p&&/auto|scroll|hidden/.test(getComputedStyle(p).overflowX))return;var t=el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\\s+/)[0]:'');wide.push({el:t,left:Math.round(er.left),right:Math.round(er.right)});}});
  var small=[];
  Array.prototype.forEach.call(m.querySelectorAll('button'),function(b){var br=b.getBoundingClientRect();if(!br.width||!br.height)return;if((br.width<40||br.height<40)&&small.length<6)small.push({t:(b.innerText||b.getAttribute('aria-label')||'').trim().slice(0,30),w:Math.round(br.width),h:Math.round(br.height)});});
  var footer=m.querySelector('.modal-footer, .modal-actions');
  var fr=footer?footer.getBoundingClientRect():null;
  return {id:id,top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right),vw:vw,vh:vh,hScroll:m.scrollWidth>m.clientWidth+1,wide:wide,small:small,footerBottom:fr?Math.round(fr.bottom):null,title:((m.querySelector('.modal-title')||{}).innerText||'').trim().slice(0,40)};
})`;

// .main is the scroll container (height:100vh, overflow:auto), so Playwright's
// fullPage only captures one screen. Let it grow for the shot, then restore.
async function shotFull(page, file) {
  await page.evaluate(() => { const m = document.querySelector('.main'); if (m) { m.dataset.h = m.style.height; m.dataset.o = m.style.overflowY; m.style.height = 'auto'; m.style.overflowY = 'visible'; } });
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  await page.evaluate(() => { const m = document.querySelector('.main'); if (m) { m.style.height = m.dataset.h || ''; m.style.overflowY = m.dataset.o || ''; } });
}

(async () => {
  const browser = await pw.chromium.launch();
  for (const W of WIDTHS) {
    const H = W <= 320 ? 568 : 844;
    for (const state of (STATE === 'both' ? ['empty', 'seeded'] : [STATE])) {
      const tag = W + '-' + state;
      console.log('\n===== ' + tag + ' =====');
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, locale: 'he-IL', deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      page.on('dialog', (d) => d.dismiss().catch(() => {}));
      await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
      await page.goto(HTML, { waitUntil: 'load' });
      await page.waitForTimeout(700);
      await page.evaluate(() => {
        document.getElementById('login').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        window._currentUser = { username: 'admin', role: 'אדמין', name: 'מיכאל פרייליך' };
        if (typeof _applyRoleGates === 'function') _applyRoleGates();
        window.toast = function () {};
        window.print = function () {};
        window.open = function () { return null; };
        window.confirm = function () { return false; };
      });
      if (state === 'seeded') { await page.evaluate(SEED); }
      await page.evaluate(() => { try { rDash(); } catch (e) {} });
      await page.waitForTimeout(300);
      const dir = path.join(OUT, tag); fs.mkdirSync(dir, { recursive: true });

      const pages = ONLY ? ONLY.split(',') : PAGES;
      for (const pid of pages) {
        errs.length = 0;
        console.log('\n-- ' + pid);
        const ok = await page.evaluate((p) => { try { goPage(p); return document.getElementById('pg-' + p) && getComputedStyle(document.getElementById('pg-' + p)).display !== 'none'; } catch (e) { return 'ERR ' + e.message; } }, pid);
        await page.waitForTimeout(350);
        if (ok !== true) { note('defect', tag + '/' + pid, 'page did not open', ok); continue; }
        if (errs.length) note('defect', tag + '/' + pid, 'page error while rendering', errs.slice(0, 3));
        const m = await page.evaluate(MEASURE + '(' + JSON.stringify(pid) + ')');
        await shotFull(page, path.join(dir, pid + '.png'));
        note('info', tag + '/' + pid, m.controls + ' controls, ' + m.menuBtns.length + ' menus, ' + m.modals.length + ' modals reachable');
        if (m.scrollWidth > m.vw + 1) note('defect', tag + '/' + pid, 'page scrolls horizontally', { scrollWidth: m.scrollWidth, vw: m.vw, offenders: m.offenders });
        else if (m.offenders.length) note('defect', tag + '/' + pid, 'elements stick out of the viewport', m.offenders);
        if (m.cut.length) note('warn', tag + '/' + pid, 'text cut without ellipsis', m.cut);
        if (m.covered.length) note('defect', tag + '/' + pid, 'controls covered by a fixed element at their natural scroll position', m.covered);
        if (m.smallCount) note('warn', tag + '/' + pid, m.smallCount + ' touch targets under 40px', m.small);
        if (Object.keys(m.glyphs).length) note('info', tag + '/' + pid, 'text-presentation glyphs (may render as a box on iOS)', m.glyphs);

        // Row / header menus
        for (const b of m.menuBtns) {
          errs.length = 0;
          const r = await page.evaluate(async (idx) => {
            const el = document.querySelector('[data-audit-idx="' + idx + '"]'); if (!el) return { gone: true };
            el.scrollIntoView({ block: 'end' });
            el.click();
            await new Promise((res) => setTimeout(res, 200));
            return null;
          }, b.idx);
          if (r && r.gone) continue;
          const mm = await page.evaluate(MEASURE_MENU + '()');
          if (errs.length) note('defect', tag + '/' + pid, 'error opening menu ' + b.el, errs.slice(0, 2));
          if (!mm) { note('warn', tag + '/' + pid, 'menu button opened nothing measurable: ' + b.el, b.oc); }
          else {
            const slug = (mm.id || 'menu') + '-' + b.idx;
            await page.screenshot({ path: path.join(dir, pid + '--' + slug + '.png') }).catch(() => {});
            const inside = mm.top >= 0 && mm.bottom <= mm.vh && mm.left >= 0 && mm.right <= mm.vw;
            if (!inside || mm.outside.length) note('defect', tag + '/' + pid, 'menu runs off the screen: ' + b.el, mm);
            if (mm.cut.length) note('warn', tag + '/' + pid, 'menu labels cut: ' + b.el, mm.cut);
          }
          await page.evaluate(() => { document.querySelectorAll('body > div').forEach((d) => { const cs = getComputedStyle(d); if (cs.position === 'fixed' && parseInt(cs.zIndex || 0, 10) >= 999 && !/^(m-|ov-)/.test(d.id || '') && d.querySelectorAll('button').length) d.remove(); }); });
          await page.evaluate(() => { const main = document.querySelector('.main'); if (main) main.scrollTop = 0; window.scrollTo(0, 0); });
        }

        // Modals reachable from this page
        for (const mo of m.modals) {
          errs.length = 0;
          await page.evaluate((id) => { try { openModal(id); } catch (e) {} }, mo.id);
          await page.waitForTimeout(300);
          const md = await page.evaluate(MEASURE_MODAL + '(' + JSON.stringify(mo.id) + ')');
          if (errs.length) note('defect', tag + '/' + pid, 'error opening modal ' + mo.id, errs.slice(0, 2));
          if (!md || md.notShown) { note('info', tag + '/' + pid, 'modal did not show on openModal: ' + mo.id + ' (from ' + mo.from + ')'); }
          else {
            await page.screenshot({ path: path.join(dir, pid + '--' + mo.id + '.png') }).catch(() => {});
            if (md.left < -1 || md.right > md.vw + 1) note('defect', tag + '/' + pid, 'modal wider than the screen: ' + mo.id, md);
            if (md.hScroll || md.wide.length) note('defect', tag + '/' + pid, 'modal content overflows horizontally: ' + mo.id, { hScroll: md.hScroll, wide: md.wide, title: md.title });
            if (md.small.length) note('warn', tag + '/' + pid, 'modal buttons under 40px: ' + mo.id, md.small);
            if (md.footerBottom !== null && md.footerBottom > md.vh + 1) note('defect', tag + '/' + pid, 'modal footer (save/cancel) below the screen: ' + mo.id, md);
          }
          await page.evaluate((id) => { try { closeModal(id); } catch (e) {} const ov = document.getElementById('ov-' + id.replace(/^m-/, '')); if (ov) ov.style.display = 'none'; }, mo.id);
          await page.waitForTimeout(100);
        }
      }

      // The trustee kiosk (employee mode): the screen every trustee holds, and
      // the tour form. Entered the way trustee-t2-test.js enters it.
      if (!ONLY || ONLY.includes('emp-home')) {
        errs.length = 0;
        const entered = await page.evaluate(async () => {
          try { localStorage.setItem('tfgn_emp_code', 'RIGHT'); } catch (e) {}
          try { doEmpLogin(); } catch (e) { return 'ERR ' + e.message; }
          const t0 = Date.now();
          while (CUR !== 'emp-home' && Date.now() - t0 < 4000) await new Promise((r) => setTimeout(r, 50));
          return CUR === 'emp-home';
        });
        await page.waitForTimeout(400);
        if (entered !== true) note('defect', tag + '/emp-home', 'trustee kiosk did not open', entered);
        else {
          const m = await page.evaluate(MEASURE + '("emp-home")');
          await shotFull(page, path.join(dir, 'emp-home.png'));
          note('info', tag + '/emp-home', m.controls + ' controls, ' + m.menuBtns.length + ' menus, ' + m.modals.length + ' modals reachable');
          if (m.scrollWidth > m.vw + 1 || m.offenders.length) note('defect', tag + '/emp-home', 'trustee screen overflows', m.offenders);
          if (m.cut.length) note('warn', tag + '/emp-home', 'text cut without ellipsis', m.cut);
          if (m.covered.length) note('defect', tag + '/emp-home', 'controls covered', m.covered);
          if (m.smallCount) note('warn', tag + '/emp-home', m.smallCount + ' touch targets under 40px', m.small);
          if (errs.length) note('defect', tag + '/emp-home', 'page error', errs.slice(0, 2));
          // Pick a name, open the tour form for task 1 and for the hazard-only report.
          for (const n of [1, 4]) {
            errs.length = 0;
            await page.evaluate((n) => { try { _truSetMe('מוסא'); _truReport(n); } catch (e) {} }, n);
            await page.waitForTimeout(400);
            const md = await page.evaluate(MEASURE_MODAL + '("m-tru")');
            if (errs.length) note('defect', tag + '/emp-home', 'error opening the tour form ' + n, errs.slice(0, 2));
            if (!md || md.notShown) note('warn', tag + '/emp-home', 'tour form did not open for task ' + n);
            else {
              await page.screenshot({ path: path.join(dir, 'emp-home--m-tru-' + n + '.png') }).catch(() => {});
              if (md.left < -1 || md.right > md.vw + 1) note('defect', tag + '/emp-home', 'tour form wider than the screen (task ' + n + ')', md);
              if (md.hScroll || md.wide.length) note('defect', tag + '/emp-home', 'tour form content overflows horizontally (task ' + n + ')', { hScroll: md.hScroll, wide: md.wide });
              if (md.small.length) note('warn', tag + '/emp-home', 'tour form buttons under 40px (task ' + n + ')', md.small);
            }
            await page.evaluate(() => { try { _truCloseReport(true); } catch (e) {} try { closeModal('m-tru'); } catch (e) {} });
            await page.waitForTimeout(150);
          }
          await page.evaluate(() => { document.body.classList.remove('emp-mode'); try { localStorage.removeItem('tfgn_emp_mode'); localStorage.removeItem('tfgn_emp_code'); } catch (e) {} });
        }
      }

      // The generic detail view for a few seeded records.
      if (state === 'seeded') {
        for (const [tbl, id] of [['near_miss', 'seed_nm0'], ['equip_inspections', 'seed_eqi0'], ['inc', 'seed_inc0'], ['docs', 'seed_docs0'], ['ncr', 'seed_ncr0']]) {
          errs.length = 0;
          const shown = await page.evaluate(([t, i]) => { try { showView(t, i); return getComputedStyle(document.getElementById('pg-view')).display !== 'none'; } catch (e) { return 'ERR ' + e.message; } }, [tbl, id]);
          await page.waitForTimeout(300);
          if (shown !== true) { note('warn', tag + '/view', 'showView(' + tbl + ') did not open', shown); continue; }
          const m = await page.evaluate(MEASURE + '("view")');
          await shotFull(page, path.join(dir, 'view-' + tbl + '.png'));
          if (m.scrollWidth > m.vw + 1 || m.offenders.length) note('defect', tag + '/view-' + tbl, 'detail view overflows', m.offenders);
          if (m.covered.length) note('defect', tag + '/view-' + tbl, 'controls covered', m.covered);
          if (errs.length) note('defect', tag + '/view-' + tbl, 'page error', errs.slice(0, 2));
        }
      }
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 1));
  const defects = findings.filter((f) => f.sev === 'defect').length;
  const warns = findings.filter((f) => f.sev === 'warn').length;
  console.log('\n' + defects + ' defects, ' + warns + ' warnings, ' + (findings.length - defects - warns) + ' notes. Screenshots: ' + OUT);
  process.exit(defects ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
