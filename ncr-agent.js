/* NCR AI Agent TFUGEN SAFETY v4 — persisted analyses + ISO 45001/14001 prompt */
var _nad=[];
var _naf={};
var _naVer={};
var _SB='https://znhjtpcltrxxyfjczgvw.supabase.co';
var _SK='sb_publishable_N2ihyyjK_qZEyB0vqunNtQ_oi4roa0M';
var _AI='/api/claude';
var _AI_MODEL='claude-sonnet-4-6';
var _P={'q':{bg:'#3d0000',b:'#ff2222',c:'#ff3333'},'h':{bg:'#3d1a00',b:'#ff6600',c:'#ff7700'},'m':{bg:'#2d2a00',b:'#f0c000',c:'#f0c000'},'l':{bg:'#001a0d',b:'#00aa44',c:'#00cc55'}};
var _SC={'closed':'#00cc55','open':'#ff4444','wip':'#f0a000'};
function _gpc(p){return _P[p==='\u05e7\u05e8\u05d9\u05d8\u05d9'?'q':p==='\u05d2\u05d1\u05d5\u05d4\u05d4'?'h':p==='\u05e0\u05de\u05d5\u05db\u05d4'?'l':'m']||_P.m;}
function _gsc(s){return s==='\u05e1\u05d2\u05d5\u05e8'?'#00cc55':s==='\u05e4\u05ea\u05d5\u05d7'?'#ff4444':s==='\u05d1\u05d8\u05d9\u05e4\u05d5\u05dc'?'#f0a000':'#7a9ab8';}
window.openNCRAgent=function(){document.getElementById('ncr-agent-modal').style.display='flex';_ncrLoad();};
function _ncrLoad(){
  var L=document.getElementById('ncr-agent-list');
  L.innerHTML='<div style="text-align:center;padding:40px;color:#4a6a8a">Loading...</div>';
  fetch(_SB+'/rest/v1/ncr?select=*&limit=500&order=created_at.desc',{headers:{apikey:_SK,Authorization:'Bearer '+_SK,Prefer:'count=exact'}})
  .then(function(r){var ct=r.headers.get('content-range');return r.json().then(function(d){return{d:d,ct:ct};});})
  .then(function(res){
    _nad=Array.isArray(res.d)?res.d:[];
    var ce=document.getElementById('ncr-agent-count');
    if(ce)ce.textContent=res.ct?res.ct.split('/')[1]:_nad.length;
    return _ncrLoadAI();
  })
  .then(function(){_ncrRender();})
  .catch(function(){L.innerHTML='<div style="text-align:center;padding:40px;color:#ff4444">Error</div>';});
}
function _ncrLoadAI(){
  return fetch(_SB+'/rest/v1/ncr_ai?select=*&order=version.desc',{headers:{apikey:_SK,Authorization:'Bearer '+_SK}})
  .then(function(r){return r.ok?r.json():[];})
  .then(function(rows){
    if(!Array.isArray(rows))return;
    rows.forEach(function(r){
      if((_naVer[r.ncr_id]||0)>=r.version)return;
      _naf[r.ncr_id]={
        risk:r.risk,
        root_cause:r.rc,
        immediate_action:r.ia,
        corrective_actions:Array.isArray(r.ca)?r.ca:[],
        preventive:r.prev,
        owner_suggested:r.owner_suggested||'',
        due_suggested:r.due_suggested||'',
        version:r.version
      };
      _naVer[r.ncr_id]=r.version;
    });
  })
  .catch(function(){});
}
function _ncrRender(){
  var L=document.getElementById('ncr-agent-list');
  if(!_nad.length){L.innerHTML='<div style="text-align:center;padding:40px;color:#4a6a8a">No data</div>';return;}
  var h='';
  _nad.forEach(function(n){
    var pc=_gpc(n.p),sc=_gsc(n.s),an=_naf[n.id];
    h+='<div onclick="_ncrSel(\'' +n.id+ '\'" style="background:'+pc.bg+';border-right:3px solid '+pc.b+';border-radius:7px;padding:9px 12px;margin-bottom:5px;cursor:pointer;display:flex;align-items:center;gap:10px">';
    h+='<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:700;color:#4a7aaa">'+(n.num||'')+'</div>';
    h+='<div style="font-size:12px;color:#ddeeff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(n.d||'')+'</div>';
    h+='<div style="font-size:10px;color:#5a7a9a">'+(n.a||'')+(n.o?' - '+n.o:'')+'</div></div>';
    h+='<div style="display:flex;gap:4px"><span style="background:'+sc+'22;border:1px solid '+sc+'55;border-radius:20px;padding:1px 7px;font-size:9px;color:'+sc+'">'+(n.s||'')+'</span>';
    h+='<span style="background:'+pc.c+'22;border:1px solid '+pc.c+'55;border-radius:20px;padding:1px 7px;font-size:9px;color:'+pc.c+'">'+(n.p||'')+'</span>';
    if(an&&an.risk)h+='<span style="font-size:9px;color:#4a9adf">&#10003;AI'+(an.version?' v'+an.version:'')+'</span>';
    h+='</div></div>';
  });
  L.innerHTML=h;
}
window._ncrSel=function(id){
  var n=_nad.find(function(x){return x.id===id;});if(!n)return;
  var P=document.getElementById('ncr-agent-panel');P.style.display='block';
  var pc=_gpc(n.p),sc=_gsc(n.s);
  var h='<div style="background:#111416;border:1px solid #1e3a5f;border-radius:8px;padding:10px 12px;margin-bottom:8px">';
  h+='<div style="font-size:10px;color:#4a7aaa">'+(n.num||'')+'</div>';
  h+='<div style="font-size:13px;font-weight:700;color:#fff">'+(n.d||'')+'</div>';
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px">';
  if(n.a)h+='<span style="background:#1a2a3a;border-radius:4px;padding:2px 6px;font-size:9px;color:#7a9ab8">'+n.a+'</span>';
  if(n.o)h+='<span style="background:#1a2a3a;border-radius:4px;padding:2px 6px;font-size:9px;color:#7a9ab8">'+n.o+'</span>';
  h+='</div>'+(n.c?'<div style="font-size:11px;color:#7aaa7a;margin-top:5px">'+n.c+'</div>':'')+'</div>';
  var an=_naf[id];
  if(an&&!an.err)h+=_ncrFmt(an,pc);
  else if(!an)h+='<button onclick="_ncrAI(\'' +id+ '\'" style="width:100%;background:#1a3a5a;border:1px solid #2a6aaa;border-radius:8px;color:#4a9adf;padding:10px;font-size:13px;font-weight:700;cursor:pointer">&#129302; Analyze with Claude</button>';
  else h+='<div style="color:#ff4444;text-align:center;padding:12px">Error</div>';
  P.innerHTML=h;
};
function _ncrFmt(an,pc){
  var h='';
  if(an.risk){var rc=_gpc(an.risk);
    h+='<div style="background:'+rc.bg+';border:1px solid '+rc.b+';border-radius:8px;padding:8px 12px;display:flex;justify-content:space-between;margin-bottom:7px"><span style="color:#aaccee">Risk</span><span style="font-weight:800;color:'+rc.c+'">'+an.risk+'</span></div>';
  }
  var secs=[{i:'&#128269;',col:'#4a9adf',v:an.root_cause},{i:'&#9889;',col:'#ff6600',v:an.immediate_action},{i:'&#128737;',col:'#9a4adf',v:an.preventive}];
  secs.forEach(function(s){if(!s.v)return;
    h+='<div style="background:#111416;border-right:3px solid '+s.col+';border-radius:8px;padding:9px 12px;margin-bottom:7px">';
    h+='<div style="font-size:11px;color:'+s.col+';">'+s.i+'</div><div style="font-size:12px;color:#aaccee;line-height:1.6">'+s.v+'</div></div>';
  });
  if(an.corrective_actions&&an.corrective_actions.length){
    h+='<div style="background:#0d1a0d;border-right:3px solid #00cc55;border-radius:8px;padding:9px 12px;margin-bottom:7px">';
    h+='<div style="color:#00cc55;margin-bottom:5px">CAPA</div>';
    an.corrective_actions.forEach(function(a,i){h+='<div style="font-size:12px;color:#aaccaa;margin-bottom:4px">'+(i+1)+'. '+a+'</div>';});
    h+='</div>';
  }
  return h;
}
window._ncrAI=function(id){
  var n=_nad.find(function(x){return x.id===id;});if(!n)return;
  document.getElementById('ncr-agent-panel').innerHTML+='<div style="text-align:center;padding:20px;color:#4a6a8a">Analyzing...</div>';
  var prompt=
    'You are a safety expert at Tfugen Industries, certified in ISO 45001 (occupational health & safety) and ISO 14001 (environmental management).\n\n'+
    'Analyze the following NCR using the 5 Whys method and ISO risk framework, then respond with a HEBREW JSON object only.\n\n'+
    'NCR: '+(n.num||'')+'\n'+
    'Description: '+(n.d||'')+'\n'+
    'Category: '+(n.category||'')+' (saf=safety, env=environment)\n'+
    'Area: '+(n.a||'')+'\n'+
    'Priority: '+(n.p||'')+'\n'+
    'Location: '+(n.loc||n.location||'')+'\n'+
    'Source date: '+(n.sd||n.src_date||'')+'\n'+
    'Notes: '+(n.notes||'')+'\n\n'+
    'Schema (respond in Hebrew values, JSON only, no markdown fences):\n'+
    '{\n'+
    '  "risk": "critical|high|medium|low",\n'+
    '  "root_cause": "2-3 sentences, deeper than the symptom",\n'+
    '  "immediate_action": "one action to contain the risk now",\n'+
    '  "corrective_actions": ["SMART 1", "SMART 2", "SMART 3"],\n'+
    '  "preventive": "one systemic preventive action",\n'+
    '  "owner_suggested": "role such as production manager / safety / maintenance (not a person name)",\n'+
    '  "due_days": 14\n'+
    '}';
  fetch(_AI,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:_AI_MODEL,max_tokens:900,messages:[{role:'user',content:prompt}]})
  }).then(function(r){return r.json();}).then(function(d){
    var t=d.content&&d.content[0]?d.content[0].text:'';
    var obj=JSON.parse(t.replace(/```json|```/g,'').trim());
    var nextVer=(_naVer[id]||0)+1;
    var dueDate=null;
    if(typeof obj.due_days==='number'&&obj.due_days>0){
      dueDate=new Date(Date.now()+obj.due_days*86400000).toISOString().split('T')[0];
    }
    _naf[id]={
      risk:obj.risk,
      root_cause:obj.root_cause,
      immediate_action:obj.immediate_action,
      corrective_actions:obj.corrective_actions||[],
      preventive:obj.preventive,
      owner_suggested:obj.owner_suggested||'',
      due_suggested:dueDate||'',
      version:nextVer
    };
    _naVer[id]=nextVer;
    fetch(_SB+'/rest/v1/ncr_ai',{
      method:'POST',
      headers:{apikey:_SK,Authorization:'Bearer '+_SK,'Content-Type':'application/json',Prefer:'return=minimal'},
      body:JSON.stringify({
        ncr_id:id,
        version:nextVer,
        risk:obj.risk||null,
        rc:obj.root_cause||null,
        ia:obj.immediate_action||null,
        ca:obj.corrective_actions||null,
        prev:obj.preventive||null,
        owner_suggested:obj.owner_suggested||null,
        due_suggested:dueDate||null
      })
    }).catch(function(){});
    _ncrRender();window._ncrSel(id);
  }).catch(function(){_naf[id]={err:true};window._ncrSel(id);});
};
window.ncrAgentAnalyzeAll=function(){
  var P=document.getElementById('ncr-agent-panel');
  P.style.display='block';
  var open=_nad.filter(function(n){return n.s==='\u05e4\u05ea\u05d5\u05d7'||n.s==='\u05d1\u05d8\u05d9\u05e4\u05d5\u05dc';});
  P.innerHTML='<div style="text-align:center;padding:30px;color:#4a6a8a">Analyzing '+open.length+' open NCRs...</div>';
  var byA={},byP={},byS={};
  open.forEach(function(n){byA[n.a]=(byA[n.a]||0)+1;byP[n.p]=(byP[n.p]||0)+1;byS[n.s]=(byS[n.s]||0)+1;});
  var sample=open.slice(0,150).map(function(n){return n.num+' ['+(n.p||'')+'] '+(n.a||'')+': '+(n.d||'');}).join('\n');
  var prompt=
    'You are a safety analyst at Tfugen Industries, certified in ISO 45001 and ISO 14001.\n'+
    'Analyze the OPEN NCRs below and respond in Hebrew only.\n\n'+
    'Total open: '+open.length+' (sample: '+Math.min(open.length,150)+').\n'+
    'By area: '+JSON.stringify(byA)+'\n'+
    'By priority: '+JSON.stringify(byP)+'\n'+
    'By status: '+JSON.stringify(byS)+'\n\n'+
    'Sample:\n'+sample+'\n\n'+
    'Respond in Hebrew, in 4 clearly separated sections with headers:\n'+
    '1. Patterns / \u05d3\u05e4\u05d5\u05e1\u05d9\u05dd \u05d7\u05d5\u05d6\u05e8\u05d9\u05dd\n'+
    '2. Risk areas / \u05d0\u05d6\u05d5\u05e8\u05d9 \u05e1\u05d9\u05db\u05d5\u05df \u05d2\u05d1\u05d5\u05d4\n'+
    '3. Systemic recommendations / \u05d4\u05de\u05dc\u05e6\u05d5\u05ea \u05de\u05e2\u05e8\u05db\u05ea\u05d9\u05d5\u05ea\n'+
    '4. Urgent alerts / \u05d4\u05ea\u05e8\u05d0\u05d5\u05ea \u05d3\u05d7\u05d5\u05e4\u05d5\u05ea';
  fetch(_AI,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:_AI_MODEL,max_tokens:1500,messages:[{role:'user',content:prompt}]})
  }).then(function(r){return r.json();}).then(function(d){
    P.innerHTML='<div style="font-size:12px;line-height:1.8;color:#c0d4e8;white-space:pre-wrap;padding:4px">'+(d.content&&d.content[0]?d.content[0].text:'Error')+'</div>';
  }).catch(function(){P.innerHTML='<div style="color:#ff4444;text-align:center">Error</div>';});
};
console.log('NCR Agent v4 ready, '+(_nad?_nad.length:0)+' items');