// Interaction QA, 2026-09-20. Each of the nine merges from 2026-09-19 has its
// own suite; this one covers where they MEET, which is where nothing was
// watching. It found one real thing: closeModal left an edit armed.
const path=require('path');let pw;try{pw=require('playwright')}catch(e){pw=require('playwright-core')}
const HTML='file://'+path.resolve(__dirname,'../../index.html');
let pass=0,fail=0;
const check=(l,c,d)=>{if(c){pass++;console.log('  ✓ '+l);}else{fail++;console.log('  ✗ '+l+(d!==undefined?'  -> '+JSON.stringify(d):''));}};
(async()=>{
 const b=await pw.chromium.launch();const ctx=await b.newContext({viewport:{width:375,height:812},locale:'he-IL'});const p=await ctx.newPage();
 const prompts=[];p.on('dialog',d=>{prompts.push(d.message());d.accept().catch(()=>{});});
 await p.route('**/*',r=>r.request().url().startsWith('file://')?r.continue():r.abort());
 await p.goto(HTML,{waitUntil:'load'});await p.waitForTimeout(800);
 await p.evaluate(()=>{
   document.getElementById('login').style.display='none';document.getElementById('app').style.display='block';
   window.sbIns=function(){};window.sbUpd=function(){};window.sdb=function(){};window.addLog=function(){};
   window._currentUser={username:'admin'};_isAdmin=true;_applyRoleGates();
 });

 console.log('\n1. #611 edit-state vs #610 trustee draft — different mechanisms, no crosstalk');
 {
  const r=await p.evaluate(()=>{
    DB.rsk=[{id:'r1',d:'סיכון',a:'אזור'}];
    _genEdit('rsk','r1');                       // editing a risk
    const during=_svEditId('rsk');
    document.body.classList.add('emp-mode');
    DB.trustees=[{id:'t1',n:'מוסא',active:true}];DB.trustee_reports=[];
    _truFormReset();_truReport();               // opens m-tru -> openModal -> clears edit state
    const afterTru=_svEditId('rsk');
    closeModal('m-tru');document.body.classList.remove('emp-mode');
    return {during,afterTru};
  });
  check('opening the trustee form clears a pending risk edit instead of leaving it armed',r.during==='r1'&&r.afterTru===null,r);
 }

 console.log('\n2. #605 eb() vs #609 fonts — the badge renders in every state');
 {
  const r=await p.evaluate(()=>({
    none:eb(null),empty:eb(''),past:eb('2020-01-01'),soon:eb(new Date(Date.now()+5*864e5).toISOString().substring(0,10)),far:eb('2099-01-01')
  }));
  check('null and "" say אין תאריך, past is red, soon amber, far green',
    /אין תאריך/.test(r.none)&&/אין תאריך/.test(r.empty)&&/bR/.test(r.past)&&/bY/.test(r.soon)&&/bG/.test(r.far),r);
 }

 console.log('\n3. #608 delete guard vs #604 NCR numbering — deleting does not free a number');
 {
  const r=await p.evaluate(()=>{
    DB.ncr=[{id:'a',num:'NCR-0001',d:'x',s:'פתוח'},{id:'b',num:'NCR-0002',d:'y',s:'פתוח'}];
    const _realPush=window._obPush;window._obPush=function(){};
    const before=_ncrNextNum();
    sbDel('ncr','b');DB.ncr=DB.ncr.filter(x=>x.id!=='b');
    const mid=(function(){DB.ncr=[{id:'a',num:'NCR-0001',d:'x'},{id:'b',num:'NCR-0002',d:'y'},{id:'c',num:'NCR-0003',d:'z'}];DB.ncr=DB.ncr.filter(x=>x.id!=='b');return _ncrNextNum();})();
    window._obPush=_realPush;
    return {before,after:_ncrNextNum(),mid,rows:DB.ncr.length};
  });
  check('deleting a MIDDLE record never frees its number: 0002 gone, next is still 0004',r.mid==='NCR-0004',r);
  check('a new number never lands on a record that still exists',!/^NCR-000[13]$/.test(r.after),r);
 }

 console.log('\n4. #606 memory queue vs #607 pull-only sync');
 {
  const r=await p.evaluate(()=>{
    localStorage.removeItem('tfgn_outbox');_obMem.length=0;_obFull=false;_obWarnFull._shown=false;
    const real=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){if(k==='tfgn_outbox'){const e=new Error('q');e.name='QuotaExceededError';throw e;}return real.call(this,k,v);};
    _obPush({op:'ins',tbl:'ncr',row:{id:'z',num:'NCR-9',d:'x'}});
    Storage.prototype.setItem=real;
    let msg=null;const rc=window.confirm;window.confirm=function(m){msg=m;return false;};
    forceSync();window.confirm=rc;
    return {held:_obMem.length,msg};
  });
  check('a report held only in memory is counted in the pull warning',r.held===1&&/1 פעולות/.test(r.msg||''),r);
  check('and the warning says a pull could overwrite it',/לדרוס/.test(r.msg||''),r.msg);
 }

 console.log('\n5. #611 editing a record that #608 protects');
 {
  const r=await p.evaluate(()=>{
    DB.near_miss=[{id:'nm1',descr:'כמעט ונפגע',area:'מחסן',d:'2026-09-01'}];
    _genEdit('near_miss','nm1');
    const opened=getComputedStyle(g('m-nm')).display!=='none';
    closeModal('m-nm');
    askDel('near_miss','nm1');
    const what=(g('del-what')||{}).innerText||'';
    const warn=(()=>{const w=g('del-warn');return w&&getComputedStyle(w).display!=='none';})();
    cancelDel();
    return {opened,what,warn,stillEditing:_svEditId('near_miss')};
  });
  check('a near-miss can be edited, and deleting it still names the record',r.opened&&/כמעט/.test(r.what),r);
  check('opening the delete dialog did not leave an edit armed',r.stillEditing===null,r);
 }

 await b.close();
 console.log('\n'+pass+' passed, '+fail+' failed');
 process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
