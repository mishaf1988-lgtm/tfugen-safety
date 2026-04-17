# TFUGEN — תבניות קוד

דוגמאות מוכנות להעתקה.

## 1. המרת עברית ל-\uXXXX

### ב-Node.js / Browser Console:
```js
[...'קריטי'].map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('')
// → '\u05e7\u05e8\u05d9\u05d8\u05d9'
```

### מיפוי נפוץ:
| מילה | Unicode |
|---|---|
| קריטי | `\u05e7\u05e8\u05d9\u05d8\u05d9` |
| גבוהה | `\u05d2\u05d1\u05d5\u05d4\u05d4` |
| בינונית | `\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9\u05ea` |
| נמוכה | `\u05e0\u05de\u05d5\u05db\u05d4` |
| סגור | `\u05e1\u05d2\u05d5\u05e8` |
| פתוח | `\u05e4\u05ea\u05d5\u05d7` |
| בטיפול | `\u05d1\u05d8\u05d9\u05e4\u05d5\u05dc` |

## 2. קריאה ל-Supabase

```js
var _SB='https://znhjtpcltrxxyfjczgvw.supabase.co';
var _SK='sb_publishable_N2ihyyjK_qZEyB0vqunNtQ_oi4roa0M';

// GET
fetch(_SB+'/rest/v1/TABLE?select=*&limit=500&order=created_at.desc', {
  headers:{
    apikey: _SK,
    Authorization: 'Bearer '+_SK,
    Prefer: 'count=exact'
  }
})
.then(r=>r.json())
.then(data=>{ /* ... */ });

// POST (INSERT)
fetch(_SB+'/rest/v1/TABLE', {
  method: 'POST',
  headers:{
    apikey: _SK,
    Authorization: 'Bearer '+_SK,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  },
  body: JSON.stringify({
    field1: value1,
    date_field: dateValue || null   // ← תמיד || null לתאריכים
  })
});

// PATCH (UPDATE)
fetch(_SB+'/rest/v1/TABLE?id=eq.'+id, {
  method: 'PATCH',
  headers:{ apikey:_SK, Authorization:'Bearer '+_SK, 'Content-Type':'application/json' },
  body: JSON.stringify({ status: '\u05e1\u05d2\u05d5\u05e8' })
});

// DELETE — תמיד דרך askDel
askDel(id, 'TABLE', function(){ /* reload */ });
```

## 3. קריאה ל-Claude API

```js
fetch('/api/claude', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    prompt: '\u05e0\u05ea\u05d7 \u05d0\u05ea \u05d4-NCR',  // 'נתח את ה-NCR'
    model: 'claude-sonnet-4-6',
    max_tokens: 1024
  })
})
.then(r=>r.json())
.then(res=>{ /* res.completion / res.content */ });
```

## 4. הוספת View חדש ל-VIEW_CONFIG

```js
VIEW_CONFIG['expiries'] = {
  table: 'expiries',
  title: '\u05ea\u05d5\u05e7\u05e4\u05d9\u05dd',   // 'תוקפים'
  columns: [
    {key:'name', label:'\u05e9\u05dd'},            // 'שם'
    {key:'expiry_date', label:'\u05ea\u05d0\u05e8\u05d9\u05da', type:'date'},
    {key:'status', label:'\u05e1\u05d8\u05d8\u05d5\u05e1'}
  ],
  filters: ['status'],
  actions: ['edit', 'delete']
};
```

## 5. Agent Modal Pattern (כמו NCR Agent)

```js
window.openXXXAgent = function(){
  document.getElementById('xxx-agent-modal').style.display = 'flex';
  _xxxLoad();
};

function _xxxLoad(){
  var L = document.getElementById('xxx-agent-list');
  L.innerHTML = '<div style="text-align:center;padding:40px;color:#4a6a8a">Loading...</div>';
  fetch(_SB+'/rest/v1/TABLE?select=*&limit=500',{
    headers:{apikey:_SK, Authorization:'Bearer '+_SK}
  })
  .then(r=>r.json())
  .then(data=>{ /* render */ })
  .catch(()=>{ L.innerHTML='<div style="color:#ff4444">Error</div>'; });
}
```

## 6. Color Palette (מהקוד הקיים)

```js
// עדיפויות
var _P = {
  'q': {bg:'#3d0000', b:'#ff2222', c:'#ff3333'},   // קריטי
  'h': {bg:'#3d1a00', b:'#ff6600', c:'#ff7700'},   // גבוהה
  'm': {bg:'#2d2a00', b:'#f0c000', c:'#f0c000'},   // בינונית
  'l': {bg:'#001a0d', b:'#00aa44', c:'#00cc55'}    // נמוכה
};

// סטטוסים
var _SC = {
  'closed': '#00cc55',
  'open':   '#ff4444',
  'wip':    '#f0a000'
};
```
