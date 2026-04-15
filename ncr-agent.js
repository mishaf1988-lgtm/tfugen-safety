/* NCR AI Agent - TFUGEN SAFETY */
var _nad=[];
var _naf={};

function openNCRAgent(){
  document.getElementById('ncr-agent-modal').style.display='flex';
  ncrAgentLoad();
}

function ncrAgentLoad(){
  var L=document.getElementById('ncr-agent-list');
  L.innerHTML='<div style="text-align:center;padding:60px;color:#4a6a8a"><div style="font-size:32px">&#9203;</div><div style="margin-top:8px;font-size:12px">Loading NCRs...</div></div>';
  fetch('https://znhjtpcltrxxyfjczgvw.supabase.co/rest/v1/ncr?select=*&limit=500&order=created_at.desc',{
    headers:{apikey:'sb_publishable_N2ihyyjK_qZEyB0vqunNtQ_oi4roa0M',Authorization:'Bearer sb_publishable_N2ihyyjK_qZEyB0vqunNtQ_oi4roa0M',Prefer:'count=exact'}
  }).then(function(r){
    var ct=r.headers.get('content-range');
    return r.json().then(function(d){return{d:d,ct:ct};});
  }).then(function(res){
    _nad=Array.isArray(res.d)?res.d:[];
    var ce=document.getElementById('ncr-agent-count');
    if(ce)ce.textContent=res.ct?res.ct.split('/')[1]:_nad.length;
    ncrAgentRender();
  }).catch(function(){
    L.innerHTML='<div style="text-align:center;padding:40px;color:#ff4444">Error loading data</div>';
  });
}

var _PC={'קריטי':{bg:'#3d0000',b:'#ff2222',c:'#ff3333'},'גבוהה':{bg:'#3d1a00',b:'#ff6600',c:'#ff7700'},'בינונית':{bg:'#2d2a00',b:'#f0c000',c:'#f0c000'},'נמוכה':{bg:'#001a0d',b:'#00aa44',c:'#00cc55'}};
var _SC={'סגור':'#00cc55','פתוח':'#ff4444','בטיפול':'#f0a000'};
function _gpc(p){return _PC[p]||{bg:'#2d2a00',b:'#f0c000',c:'#f0c000'};}
function _gsc(s){return _SC[s]||'#7a9ab8';}

function ncrAgentRender(){
  var L=document.getElementById('ncr-agent-list');
  if(!_nad.length){L.innerHTML='<div style="text-align:center;padding:40px;color:#4a6a8a">No data</div>';return;}
  var h='';
  _nad.forEach(function(n){
    var pc=_gpc(n.p);var sc=_gsc(n.s);var an=_naf[n.id];
    h+='<div onclick="ncrAgentSel(''+n.id+'')" style="background:'+pc.bg+';border:1px solid '+pc.b+'44;border-right:3px solid '+pc.b+';border-radius:7px;padding:9px 12px;margin-bottom:5px;cursor:pointer;display:flex;align-items:center;gap:10px">';
    h+='<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">';
    h+='<span style="font-size:10px;font-weight:700;color:#4a7aaa;white-space:nowrap">'+(n.num||'')+'</span>';
    h+='<span style="font-size:12px;font-weight:600;color:#ddeeff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(n.d||'')+'</span>';
    h+='</div><div style="font-size:10px;color:#5a7a9a">'+(n.a||'')+(n.o?' &middot; '+n.o:'')+(n.u?' &middot; '+n.u:'')+'</div></div>';
    h+='<div style="display:flex;gap:4px;align-items:center;flex-shrink:0">';
    h+='<span style="background:'+sc+'22;border:1px solid '+sc+'55;border-radius:20px;padding:1px 7px;font-size:9px;font-weight:700;color:'+sc+'">'+(n.s||'')+'</span>';
    h+='<span style="background:'+pc.c+'22;border:1px solid '+pc.c+'55;border-radius:20px;padding:1px 7px;font-size:9px;font-weight:700;color:'+pc.c+'">'+(n.p||'')+'</span>';
    if(an&&an.risk)h+='<span style="font-size:9px;color:#4a9adf">&#10003;AI</span>';
    h+='</div></div>';
  });
  L.innerHTML=h;
}

function ncrAgentSel(id){
  var n=_nad.find(function(x){return x.id===id;});
  if(!n)return;
  var P=document.getElementById('ncr-agent-panel');
  P.style.display='block';
  var pc=_gpc(n.p);var sc=_gsc(n.s);
  var h='<div style="background:#111416;border:1px solid #1e3a5f;border-radius:8px;padding:10px 12px;margin-bottom:8px">';
  h+='<div style="font-size:10px;color:#4a7aaa;margin-bottom:3px">'+(n.num||'')+'</div>';
  h+='<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:6px">'+(n.d||'')+'</div>';
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap">';
  if(n.a)h+='<span style="background:#1a2a3a;border-radius:4px;padding:2px 6px;font-size:9px;color:#7a9ab8">'+n.a+'</span>';
  if(n.o)h+='<span style="background:#1a2a3a;border-radius:4px;padding:2px 6px;font-size:9px;color:#7a9ab8">'+n.o+'</span>';
  if(n.p)h+='<span style="background:'+pc.c+'22;border-radius:4px;padding:2px 6px;font-size:9px;color:'+pc.c+'">'+n.p+'</span>';
  if(n.s)h+='<span style="background:'+sc+'22;border-radius:4px;padding:2px 6px;font-size:9px;color:'+sc+'">'+n.s+'</span>';
  h+='</div>'+(n.c?'<div style="font-size:11px;color:#7aaa7a;margin-top:6px">&#10003; '+n.c+'</div>':'')+'</div>';
  var an=_naf[id];
  if(an&&!an.err){h+=_ncrFmt(an,pc);}
  else if(!an){h+='<button onclick="ncrAgentAI(''+id+'')" style="width:100%;background:#1a3a5a;border:1px solid #2a6aaa;border-radius:8px;color:#4a9adf;padding:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">&#129302; Analyze with Claude</button>';}
  else{h+='<div style="color:#ff4444;font-size:12px;text-align:center;padding:12px">Error - try again</div>';}
  P.innerHTML=h;
}

function _ncrFmt(an,pc){
  var h='';
  if(an.risk){var rc=_PC[an.risk]||pc;
    h+='<div style="background:'+rc.bg+';border:1px solid '+rc.b+';border-radius:8px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">';
    h+='<span style="font-size:11px;color:#aaccee">AI Risk Level</span>';
    h+='<span style="font-size:14px;font-weight:800;color:'+rc.c+'">'+an.risk+'</span></div>';
  }
  var secs=[
    {i:'&#128269;',t:'סיבת שורש',col:'#4a9adf',v:an.root_cause},
    {i:'&#9889;',t:'פעולה מיידית',col:'#ff6600',v:an.immediate_action},
    {i:'&#128737;',t:'מונעת',col:'#9a4adf',v:an.preventive}
  ];
  secs.forEach(function(s){
    if(!s.v)return;
    h+='<div style="background:#111416;border:1px solid '+s.col+'33;border-right:3px solid '+s.col+';border-radius:8px;padding:9px 12px;margin-bottom:7px">';
    h+='<div style="font-size:11px;font-weight:700;color:'+s.col+';margin-bottom:4px">'+s.i+' '+s.t+'</div>';
    h+='<div style="font-size:12px;color:#aaccee;line-height:1.6">'+s.v+'</div></div>';
  });
  if(an.corrective_actions&&an.corrective_actions.length){
    h+='<div style="background:#0d1a0d;border:1px solid #1a4a1a;border-right:3px solid #00cc55;border-radius:8px;padding:9px 12px;margin-bottom:7px">';
    h+='<div style="font-size:11px;font-weight:700;color:#00cc55;margin-bottom:7px">&#10003; CAPA</div>';
    an.corrective_actions.forEach(function(a,i){
      h+='<div style="display:flex;gap:6px;margin-bottom:5px;font-size:12px;color:#aaccaa"><span style="color:#00cc55">'+(i+1)+'.</span><span>'+a+'</span></div>';
    });
    h+='</div>';
  }
  return h;
}

function ncrAgentAI(id){
  var n=_nad.find(function(x){return x.id===id;});
  if(!n)return;
  var P=document.getElementById('ncr-agent-panel');
  P.innerHTML+='<div style="text-align:center;padding:20px;color:#4a6a8a">&#129302; Analyzing...</div>';
  var pr='You are a safety expert at Tfugen Industries. Analyze this NCR and respond in Hebrew.\nNCR: '+n.num+'\nDescription: '+(n.d||'')+'\nArea: '+(n.a||'')+'\nPriority: '+(n.p||'')+'\nStatus: '+(n.s||'')+'\n\nJSON only (no backticks):\n{"risk":"קריטי|גבוהה|בינונית|נמוכה","root_cause":"","immediate_action":"","corrective_actions":["","",""],"preventive":""}';
  fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:800,messages:[{role:'user',content:pr}]})
  }).then(function(r){return r.json();}).then(function(d){
    var t=(d.content&&d.content[0])?d.content[0].text:'';
    _naf[id]=JSON.parse(t.replace(/```json|```/g,'').trim());
    ncrAgentRender();ncrAgentSel(id);
  }).catch(function(){_naf[id]={err:true};ncrAgentSel(id);});
}

function ncrAgentAnalyzeAll(){
  var P=document.getElementById('ncr-agent-panel');
  P.style.display='block';
  P.innerHTML='<div style="text-align:center;padding:30px;color:#4a6a8a">&#128269; Analyzing '+_nad.length+' NCRs...</div>';
  var byA={},byP={},byS={};
  _nad.forEach(function(n){byA[n.a]=(byA[n.a]||0)+1;byP[n.p]=(byP[n.p]||0)+1;byS[n.s]=(byS[n.s]||0)+1;});
  var sample=_nad.slice(0,50).map(function(n){return '['+n.num+'] '+(n.d||'')+' | '+(n.a||'')+' | '+(n.p||'');}).join('\n');
  var pr='Analyze '+_nad.length+' NCRs for Tfugen Industries. By area: '+JSON.stringify(byA)+'. By priority: '+JSON.stringify(byP)+'. By status: '+JSON.stringify(byS)+'.\nSample:\n'+sample+'\n\nRespond in Hebrew with:\n1. **דפוסים חוזרים**\n2. **תחומי סיכון**\n3. **המלצות**\n4. **התראה דחופה**';
  fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,messages:[{role:'user',content:pr}]})
  }).then(function(r){return r.json();}).then(function(d){
    var t=(d.content&&d.content[0])?d.content[0].text:'Error';
    P.innerHTML='<div style="font-size:12px;line-height:1.8;color:#c0d4e8;white-space:pre-wrap;padding:4px">'+t+'</div>';
  }).catch(function(){P.innerHTML='<div style="color:#ff4444;text-align:center;padding:20px">Error</div>';});
}
