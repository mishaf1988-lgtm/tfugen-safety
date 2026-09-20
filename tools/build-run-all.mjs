// Builds migrations/RUN_ALL_PENDING.sql from the individual pending migrations.
//
// Seven separate migrations are waiting on Michael, and seven rounds of
// open-issue → scroll → copy → paste → run → verify, on a phone, is exactly
// the friction that has left a production Storage hole open since September.
// This makes it one paste.
//
// It is GENERATED, never hand-edited: two copies of the same SQL drift, and a
// drifted copy of a security migration is worse than not having one.
// tests/harness/run-all-sync-test.mjs fails if the file on disk does not match
// what this produces.
//
//   node tools/build-run-all.mjs          # rewrite the file
//   node tools/build-run-all.mjs --check  # exit 1 if it is stale
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');
export const MIG = path.join(ROOT, 'migrations');
export const OUT = path.join(MIG, 'RUN_ALL_PENDING.sql');

// Order is deliberate, not alphabetical: the Storage hole first, because it is
// the only one that is a live leak rather than a missing feature. The rest are
// independent of each other — no migration here reads a column another adds.
export const ORDER = [
  { file: '2026-09-20_storage_trustee_scope.sql', issue: 642, sev: '🔴', what: 'סוגר את חור ה-Storage — סשן אנונימי יכול לקרוא ולמחוק כל קובץ בדלי' },
  { file: '2026-09-20_trustee_close_ownership.sql', issue: 643, sev: '🔴', what: 'נאמן יכול לסגור רק ממצא שהוא עצמו דיווח' },
  { file: '2026-09-20_audit_log_append_only.sql', issue: 658, sev: '🟠', what: 'יומן הביקורת נהיה לקריאה והוספה בלבד — מנהל לא יכול למחוק את השורה שמתעדת אותו' },
  { file: '2026-09-20_register_attachments.sql', issue: 655, sev: '🟠', what: 'קובץ מצורף למסמכים / ציוד מגן / קבלנים' },
  { file: '2026-09-20_capa_result_and_cause.sql', issue: 679, sev: '🟠', what: 'תוצאת אימות אפקטיביות, קריטריון הצלחה, קטגוריית סיבת שורש' },
  { file: '2026-09-20_hearing_expiry_and_leg_compliance.sql', issue: 682, sev: '🟠', what: 'תוקף לבדיקות שמיעה, ורשומת ציות מתוארכת' },
  { file: '2026-09-20_history_review_verify.sql', issue: 685, sev: '🟠', what: 'היסטוריית חידושים, תיק סקירות הנהלה, אישור סגירה' },
];

const BAR = '-- ' + '='.repeat(70);

export function build() {
  const parts = [];
  parts.push(BAR);
  parts.push('-- כל המיגרציות הממתינות — 2026-09-20');
  parts.push(BAR);
  parts.push('--');
  parts.push('-- הדבק את הקובץ הזה כולו ב-Supabase → SQL Editor → + New query → Run.');
  parts.push('-- זה מחליף את שבע ההרצות הנפרדות. בטוח לחזור עליו: הכל');
  parts.push('-- IF NOT EXISTS / DO $$ guards.');
  parts.push('--');
  parts.push('-- הקובץ הזה נוצר אוטומטית מהקבצים הבודדים (tools/build-run-all.mjs).');
  parts.push('-- אל תערוך אותו ידנית — ערוך את הקובץ המקורי והרץ את הבונה מחדש.');
  parts.push('--');
  parts.push('-- מה יש כאן, לפי הסדר:');
  ORDER.forEach((m, i) => {
    parts.push(`--   ${i + 1}. ${m.sev} #${m.issue}  ${m.file}`);
    parts.push(`--        ${m.what}`);
  });
  parts.push('--');
  parts.push('-- הסדר מכוון: חור ה-Storage ראשון, כי הוא היחיד שהוא דליפה חיה');
  parts.push('-- ולא תכונה חסרה. כל השאר בלתי תלויות זו בזו.');
  parts.push('--');
  parts.push('-- ⚠ שים לב: הקטע הראשון (#642) והשלישי (#658) מחליף policies קיימות');
  parts.push('--   — DROP POLICY IF EXISTS ומיד CREATE POLICY במקום. זו המטרה שלהן:');
  parts.push('--   ה-policies הישנות הן החור. אין בהן מחיקת נתונים.');
  parts.push('--');
  parts.push('-- ⚠ בלוקי האימות והרולבק של כל מיגרציה נשארו מוערים, כמו בקבצים');
  parts.push('--   המקוריים. אף טבלה ואף עמודה לא נמחקת.');
  parts.push(BAR);
  parts.push('');

  ORDER.forEach((m, i) => {
    const src = fs.readFileSync(path.join(MIG, m.file), 'utf8').replace(/\s+$/, '');
    parts.push('');
    parts.push(BAR);
    parts.push(`-- ${i + 1}/${ORDER.length} · ${m.sev} · Issue #${m.issue} · ${m.file}`);
    parts.push(BAR);
    parts.push('');
    parts.push(src);
    parts.push('');
  });

  parts.push('');
  parts.push(BAR);
  parts.push('-- סיימת. עכשיו:');
  parts.push('--   1. להריץ את בלוקי האימות שבתוך כל קטע למעלה (הם מוערים — להסיר -- ולהריץ)');
  parts.push('--   2. לכתוב ב-Issues #642 #643 #658 #655 #679 #682 #685 שזה רץ ועבר');
  parts.push('--      → ואז אפשר לסמן ב-BACKLOG.md את 1.7 1.11 3.3 3.5 3.7 4.5 5.8 5.10 5.11 6.11');
  parts.push(BAR);
  return parts.join('\n') + '\n';
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invoked) {
  const want = build();
  if (process.argv.includes('--check')) {
    const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (have !== want) { console.error('RUN_ALL_PENDING.sql is stale — run: node tools/build-run-all.mjs'); process.exit(1); }
    console.log('RUN_ALL_PENDING.sql is up to date');
  } else {
    fs.writeFileSync(OUT, want);
    console.log('wrote ' + path.relative(ROOT, OUT) + ' (' + want.split('\n').length + ' lines, ' + ORDER.length + ' migrations)');
  }
}
