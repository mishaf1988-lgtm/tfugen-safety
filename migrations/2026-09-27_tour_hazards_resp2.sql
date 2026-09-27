-- tour_hazards: a second responsible party (27/09, Michael: "כן").
-- The sheet counts a shared hazard in BOTH responsible rows of "דוח מרכז"
-- (its own note says so). The import had folded "בטיחות + מנהל מחלקה" into
-- one responsible + a note; this restores the second one for those 3 rows
-- and takes the note back out. Additive, idempotent.
ALTER TABLE public.tour_hazards ADD COLUMN IF NOT EXISTS resp2 text;

UPDATE public.tour_hazards SET resp2 = 'בטיחות', notes = NULL
 WHERE id IN ('th-15','th-16') AND resp2 IS NULL AND notes = 'באחריות משותפת עם הבטיחות';
UPDATE public.tour_hazards SET resp2 = 'בטיחות',
       notes = replace(notes, '. באחריות משותפת עם הבטיחות', '')
 WHERE id = 'th-25' AND resp2 IS NULL AND notes LIKE '%. באחריות משותפת עם הבטיחות';

-- Verify:
-- SELECT id, resp, resp2, notes FROM public.tour_hazards WHERE resp2 IS NOT NULL;  -- th-15, th-16, th-25
-- SELECT count(*) FROM public.tour_hazards WHERE resp='בטיחות' OR resp2='בטיחות';  -- 5, as in the sheet
-- Rollback: ALTER TABLE public.tour_hazards DROP COLUMN resp2;  (destructive: Michael's OK first)
