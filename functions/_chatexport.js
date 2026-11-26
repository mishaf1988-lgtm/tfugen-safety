// A WhatsApp chat export Michael sends to the assistant (26/11/2026, Michael: "how can I get information from my own WhatsApp
// into all the knowledge", idea 50; DECISIONS 26/11/2026). Pure, no network: the export text is cut to the last days and
// stripped of what must not reach the model or any file: phone numbers, ID numbers, e-mail addresses and any message about
// health (DECISIONS 20/10/2026: no worker name next to a medical detail). Names stay (a decision is attributed to a person).
// The raw export is never stored: the caller returns this text to the assistant and keeps nothing.
export const CHAT_MAX_BYTES = 2 * 1024 * 1024;
export const CHAT_MAX_CHARS = 40000;
export const CHAT_DAYS_DEFAULT = 14;
export const CHAT_DAYS_MAX = 120;

// "26/11/2026, 14:03 - Name: text" (Android), "[26/11/2026, 14:03:12] Name: text" (iPhone); the date may use . or /
const HEAD = /^[\u200e\u200f\u202a-\u202e]*\[?(\d{1,2})[./](\d{1,2})[./](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*(?:-\s*)?/;
const PHONE_INTL = /\+\d[\d\s-]{7,14}\d/g;
const PHONE_IL = /(?<![\d])0[2-9]\d?[\s-]?\d{3}[\s-]?\d{4}(?![\d])/g;
const ID9 = /(?<![\d])\d{9}(?![\d])/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// health, as word stems: illness, sick (f), sick (pl), surgery, hospitalization, pregnancy, in pregnancy, medicine, doctor, medical, hearing
const MEDICAL = new RegExp('(?:\u05de\u05d7\u05dc\u05d4|\u05d7\u05d5\u05dc\u05d4|\u05d7\u05d5\u05dc\u05d9\u05dd|\u05e0\u05d9\u05ea\u05d5\u05d7|\u05d0\u05e9\u05e4\u05d5\u05d6|\u05d4\u05e8\u05d9\u05d5\u05df|\u05d1\u05d4\u05e8\u05d9\u05d5\u05df|\u05ea\u05e8\u05d5\u05e4|\u05e8\u05d5\u05e4\u05d0|\u05e8\u05e4\u05d5\u05d0\u05d9|\u05e9\u05de\u05d9\u05e2\u05d4)');
export const MEDICAL_MARK = '[\u05d4\u05d5\u05d3\u05e2\u05d4 \u05e8\u05e4\u05d5\u05d0\u05d9\u05ea \u05d4\u05d5\u05e1\u05e8\u05d4]';
const R_EMAIL = '[\u05d3\u05d5\u05d0"\u05dc]', R_PHONE = '[\u05d8\u05dc\u05e4\u05d5\u05df]', R_NUM = '[\u05de\u05e1\u05e4\u05e8]';

const dateOf = (m) => {
  let y = Number(m[3]); if (y < 100) y += 2000;
  return Date.UTC(y, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
};

// Pure. {text, stats}: the messages of the last `days` days (by the date written in the export), redacted, the newest
// CHAT_MAX_CHARS characters when there are more. A line with no date belongs to the message before it.
export function chatExport(raw, days, nowMs) {
  const text = String(raw == null ? '' : raw).replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
  const d = Math.min(CHAT_DAYS_MAX, Math.max(1, Math.floor(Number(days)) || CHAT_DAYS_DEFAULT));
  const since = (nowMs || Date.now()) - d * 86400e3;
  const msgs = [];
  for (const line of text.split('\n')) {
    const m = HEAD.exec(line);
    if (m) msgs.push({ at: dateOf(m), lines: [line] });
    else if (msgs.length) msgs[msgs.length - 1].lines.push(line);
  }
  const stats = { messages: msgs.length, kept: 0, medical: 0, phones: 0, ids: 0, emails: 0, days: d, truncated: false, from: null, to: null };
  const out = [];
  for (const g of msgs) {
    if (!(g.at >= since)) continue;
    stats.kept++;
    let t = g.lines.join('\n');
    if (MEDICAL.test(t)) {
      stats.medical++;
      // the header (date and sender) stays, the words go
      const h = HEAD.exec(g.lines[0]);
      const rest = g.lines[0].slice(h[0].length);
      const colon = rest.indexOf(':');
      t = g.lines[0].slice(0, h[0].length) + (colon >= 0 ? rest.slice(0, colon + 1) + ' ' : '') + MEDICAL_MARK;
    }
    t = t.replace(EMAIL, () => { stats.emails++; return R_EMAIL; })
      .replace(PHONE_INTL, () => { stats.phones++; return R_PHONE; })
      .replace(PHONE_IL, () => { stats.phones++; return R_PHONE; })
      .replace(ID9, () => { stats.ids++; return R_NUM; });
    out.push({ at: g.at, t });
  }
  if (out.length) { const ats = out.map((x) => x.at); stats.from = new Date(Math.min(...ats)).toISOString().slice(0, 10); stats.to = new Date(Math.max(...ats)).toISOString().slice(0, 10); }
  let joined = out.map((x) => x.t).join('\n');
  if (joined.length > CHAT_MAX_CHARS) {
    stats.truncated = true;
    const cut = joined.slice(joined.length - CHAT_MAX_CHARS);
    const nl = cut.indexOf('\n');
    joined = nl >= 0 ? cut.slice(nl + 1) : cut;
  }
  return { text: joined, stats };
}
