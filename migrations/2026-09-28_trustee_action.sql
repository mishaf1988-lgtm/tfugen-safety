-- trustee_reports.action: the recommended corrective action for a trustee
-- finding (28/09, Michael: "always add a corrective action; I fix it if needed").
-- Filled automatically by the server (hazard-file.js asks the assistant for
-- findings that have none), editable by the manager in the app. It is written
-- into "פעולה נדרשת" of the folder-13 register. Additive, idempotent.
ALTER TABLE public.trustee_reports ADD COLUMN IF NOT EXISTS action text;

-- The open findings of 23-28/09, recommendations approved by Michael 28/09.
-- (A fifth, mul52jc1te8t "אין מערכות כריזה צבע אדום", was then marked not
-- relevant by Michael: s = 'נסגר', mgr_note 'לא רלוונטי ...', action null.)
UPDATE public.trustee_reports SET action = 'להחליף או לתקן את גוף התאורה ולוודא תאורה תקינה ברחבה, כולל תאורת חירום' WHERE id = 'mudmp1oysfpo' AND action IS NULL;
UPDATE public.trustee_reports SET action = 'לתקן את פנסי האזהרה ולהתקין שילוט גובה מקסימלי בולט משני צידי הגשר' WHERE id = 'mudmy1x9alcf' AND action IS NULL;
UPDATE public.trustee_reports SET action = 'לנקות מיד בחומר סופג, לאתר ולתקן את מקור הדליפה, ולגדר את האזור עד לניקוי' WHERE id = 'mufdmy4z6ode' AND action IS NULL;
UPDATE public.trustee_reports SET action = 'לסמן את השקע "לא לשימוש" ולנתק אותו, ולהחליף אותו על ידי חשמלאי מוסמך' WHERE id = 'mujcdkcegzm5' AND action IS NULL;

-- Verify: SELECT id, left(action,40) FROM public.trustee_reports WHERE ok = false;  -- 4 filled, mul52jc1te8t not relevant
-- Rollback (Michael's OK first): ALTER TABLE public.trustee_reports DROP COLUMN action;
