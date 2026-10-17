-- Sample data for a DEMO site only: an invented factory, so a buyer sees full screens.
-- Never on a real factory's database. Run after db/schema.sql, in the SQL Editor.
-- Every date is relative to the day it runs, so the demo always shows something expired,
-- something urgent and something coming. Every name is invented. Safe to run again (on conflict).

insert into public.locations (id, name, level) values
  ('demo-loc-1', 'אולם ייצור', 1), ('demo-loc-2', 'אולם אריזה', 1),
  ('demo-loc-3', 'מחסן חומרי גלם', 1), ('demo-loc-4', 'חדר מכונות', 1)
on conflict (id) do nothing;

insert into public.emp (id, n, r, dep, s) values
  ('demo-emp-1', 'יוסי לוי (דוגמה)', 'מפעיל קו', 'ייצור', current_date - 900),
  ('demo-emp-2', 'רונית כהן (דוגמה)', 'ראש משמרת', 'ייצור', current_date - 2200),
  ('demo-emp-3', 'אחמד חסן (דוגמה)', 'מלגזן', 'מחסנים', current_date - 1500),
  ('demo-emp-4', 'מרינה פטרוב (דוגמה)', 'אורזת', 'אריזה', current_date - 400),
  ('demo-emp-5', 'דוד אברהם (דוגמה)', 'טכנאי', 'אחזקה', current_date - 3100),
  ('demo-emp-6', 'שירה מזרחי (דוגמה)', 'מנהלת משמרת', 'אריזה', current_date - 60)
on conflict (id) do nothing;

insert into public.docs (id, n, c, o, e, s) values
  ('demo-doc-1', 'רישיון עסק', 'רישוי והיתרים', 'הנהלה', current_date + 210, 'בתוקף'),
  ('demo-doc-2', 'אישור כבאות', 'רישוי והיתרים', 'בטיחות', current_date + 12, 'בתוקף'),
  ('demo-doc-3', 'היתר רעלים', 'רישוי והיתרים', 'בטיחות', current_date - 5, 'פג תוקף'),
  ('demo-doc-4', 'תכנית לניהול הבטיחות', 'נהלים', 'בטיחות', current_date + 70, 'בתוקף'),
  ('demo-doc-5', 'נוהל עבודה בגובה', 'נהלים', 'בטיחות', current_date + 300, 'בתוקף'),
  ('demo-doc-6', 'סקר סיכונים שנתי', 'דוחות', 'בטיחות', current_date + 40, 'בתוקף')
on conflict (id) do nothing;

insert into public.equip_inspections (id, code, n, vendor, loc, d, e, s, location_id) values
  ('demo-eqi-1', 'מל-01', 'מלגזה חשמלית', 'בודק מוסמך (דוגמה)', 'מחסן חומרי גלם', current_date - 340, current_date + 25, 'כשיר לעבודה', 'demo-loc-3'),
  ('demo-eqi-2', 'דח-01', 'מדחס אוויר', 'בודק מוסמך (דוגמה)', 'חדר מכונות', current_date - 200, current_date + 160, 'כשיר לעבודה', 'demo-loc-4'),
  ('demo-eqi-3', 'עג-01', 'עגורן גשר', 'בודק מוסמך (דוגמה)', 'אולם ייצור', current_date - 190, current_date - 8, 'פג תוקף', 'demo-loc-1'),
  ('demo-eqi-4', 'חש-01', 'לוח חשמל ראשי', 'חשמלאי בודק (דוגמה)', 'חדר מכונות', current_date - 100, current_date + 265, 'כשיר לעבודה', 'demo-loc-4')
on conflict (id) do nothing;

insert into public.tr (id, w, n, c, d, e, s) values
  ('demo-tr-1', 'יוסי לוי (דוגמה)', 'הדרכת בטיחות שנתית', 'בטיחות', current_date - 330, current_date + 35, 'completed'),
  ('demo-tr-2', 'אחמד חסן (דוגמה)', 'הסמכת מלגזן', 'בטיחות', current_date - 700, current_date - 30, 'completed'),
  ('demo-tr-3', 'מרינה פטרוב (דוגמה)', 'הדרכת בטיחות שנתית', 'בטיחות', current_date - 60, current_date + 305, 'completed'),
  ('demo-tr-4', 'דוד אברהם (דוגמה)', 'עבודה בגובה', 'בטיחות', current_date - 720, current_date + 10, 'completed')
on conflict (id) do nothing;

insert into public.tour_hazards (id, n, d, tour_no, dept, loc, location_id, descr, sev, resp, due, s, closed_d, action) values
  ('demo-th-1', 1, current_date - 20, 1, 'ייצור', 'אולם ייצור', 'demo-loc-1', 'מגן חסר על רצועת הנעה במכונה 3', 'גבוהה', 'אחזקה', current_date - 6, 'פתוח', null, null),
  ('demo-th-2', 2, current_date - 20, 1, 'מחסנים', 'מחסן חומרי גלם', 'demo-loc-3', 'משטחים חוסמים יציאת חירום', 'גבוהה', 'מחסנים', current_date - 13, 'סגור', current_date - 15, 'פונה המעבר וסומן קו צהוב'),
  ('demo-th-3', 3, current_date - 9, 2, 'אריזה', 'אולם אריזה', 'demo-loc-2', 'כבל מאריך על הרצפה במעבר', 'בינונית', 'אחזקה', current_date + 5, 'פתוח', null, null),
  ('demo-th-4', 4, current_date - 9, 2, 'ייצור', 'אולם ייצור', 'demo-loc-1', 'מטף ללא תווית בדיקה', 'נמוכה', 'בטיחות', current_date + 21, 'פתוח', null, null)
on conflict (id) do nothing;

insert into public.near_miss (id, d, descr, area, sev, typ, s, location_id) values
  ('demo-nm-1', current_date - 4, 'מלגזה כמעט פגעה בהולך רגל בפינה עיוורת', 'מחסן חומרי גלם', 'חמור', 'אחר', 'פתוח', 'demo-loc-3'),
  ('demo-nm-2', current_date - 11, 'נזילה קטנה מחבית חומר ניקוי', 'אולם אריזה', 'בינוני', 'כימי', 'בטיפול', 'demo-loc-2')
on conflict (id) do nothing;

insert into public.inc (id, d, dt, ty, l, s, dept, location_id) values
  ('demo-inc-1', 'חתך ביד בזמן החלפת סכין בקו האריזה', now() - interval '16 days', 'תאונה עם פציעה', 'אולם אריזה', 'בחקירה', 'אריזה', 'demo-loc-2')
on conflict (id) do nothing;

insert into public.ncr (id, num, d, p, o, f, s, sd, loc, location_id) values
  ('demo-ncr-1', 'D-001', 'החלפת סכינים בקו האריזה מתבצעת בלי כפפות חסינות חיתוך', 'בינונית', 'אריזה', current_date + 14, 'פתוח', current_date - 15, 'אולם אריזה', 'demo-loc-2'),
  ('demo-ncr-2', 'D-002', 'אין שילוט על פינה עיוורת במחסן', 'בינונית', 'מחסנים', current_date + 7, 'פתוח', current_date - 3, 'מחסן חומרי גלם', 'demo-loc-3')
on conflict (id) do nothing;

insert into public.tasks (id, title, assignee, due, status, priority, source_table, source_id) values
  ('demo-task-1', 'להתקין מגן על רצועת ההנעה במכונה 3', 'אחזקה', current_date - 6, 'פתוח', 'גבוה', 'tour_hazards', 'demo-th-1'),
  ('demo-task-2', 'להזמין בדיקה לעגורן הגשר', 'בטיחות', current_date + 3, 'בהתקדמות', 'גבוה', 'equip_inspections', 'demo-eqi-3'),
  ('demo-task-3', 'לחדש את היתר הרעלים', 'בטיחות', current_date + 10, 'פתוח', 'רגיל', 'docs', 'demo-doc-3')
on conflict (id) do nothing;

insert into public.leg (id, s, law_type) values
  ('demo-leg-1', 'פקודת הבטיחות בעבודה [נוסח חדש], תש"ל-1970', 'פקודה'),
  ('demo-leg-2', 'תקנות ארגון הפיקוח על העבודה (תכנית לניהול הבטיחות), תשע"ג-2013', 'תקנה'),
  ('demo-leg-3', 'תקנות הבטיחות בעבודה (ציוד מגן אישי), תשנ"ז-1997', 'תקנה'),
  ('demo-leg-4', 'תקנות הבטיחות בעבודה (עבודה בגובה), תשס"ז-2007', 'תקנה')
on conflict (id) do nothing;

insert into public.trustees (id, n, dep, active) values
  ('demo-tru-1', 'נאמן ייצור (דוגמה)', 'ייצור', true),
  ('demo-tru-2', 'נאמנת אריזה (דוגמה)', 'אריזה', true)
on conflict (id) do nothing;
