-- גיליון בטיחות (SDS) לכל חומר מסוכן (04/10/2026, מיכאל: "וגם למצוא sds ולצרף", ואישר את התוכנית).
-- תקנות הבטיחות בעבודה (גיליון בטיחות...), התשנ"ח-1998, תקנה 3(ב): המחזיק יחזיק גליון בטיחות
-- של כל חומר מסוכן, במקום נגיש לעובדים. השם file_url כמו בשאר המודולים, כך שהצירוף, העריכה
-- והצפייה הגנריים (_attachPick, _EDIT_MODS.attach, VIEW_CONFIG.photo) עובדים בלי קוד נוסף.
-- הוספה בלבד; הטבלה נמדדה 04/10/2026 עם 32 שורות (יובאו היום), אין מה לגבות בעמודה חדשה.
alter table public.hzm add column if not exists file_url text;
-- rollback: alter table public.hzm drop column if exists file_url;
