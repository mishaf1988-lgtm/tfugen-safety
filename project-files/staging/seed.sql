-- Test data for the staging project tfugen-staging (ldzbjbsumzqjyvtpiwqo) ONLY. Never on the live one.
-- 16/10/2026, Michael: "a development and test environment". All names here are invented.
-- The test user claude-test (admin) gets a random password nobody knows; a test run sets a fresh
-- one first (update auth.users set encrypted_password = extensions.crypt(<new>, extensions.gen_salt('bf'))).

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
values ('00000000-0000-0000-0000-000000000000', 'c1a0de00-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
        'claude-test@tfugen.local', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), false)
on conflict (id) do nothing;
-- GoTrue reads these as strings: NULL here = 500 "Database error querying schema" on sign-in (16/10/2026).
update auth.users set confirmation_token = coalesce(confirmation_token, ''), recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''), email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''), phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''), reauthentication_token = coalesce(reauthentication_token, '')
  where email = 'claude-test@tfugen.local';
insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
values (gen_random_uuid(), 'c1a0de00-0000-4000-8000-000000000001', 'c1a0de00-0000-4000-8000-000000000001', 'email',
        '{"sub":"c1a0de00-0000-4000-8000-000000000001","email":"claude-test@tfugen.local","email_verified":true}'::jsonb, now(), now(), now())
on conflict do nothing;
insert into public.app_users (id, username, full_name, role, dept, active, notes)
values ('claude-test', 'claude-test', 'משתמש ניסוי', 'אדמין', 'בטיחות', true, 'סביבת ניסוי בלבד')
on conflict (id) do nothing;

insert into public.locations (id, name, level) values ('loc-t1', 'אולם ייצור (דוגמה)', 1), ('loc-t2', 'מחסן (דוגמה)', 1) on conflict (id) do nothing;
insert into public.emp (id, n, r, dep, s) values
  ('emp-t1', 'ישראל ישראלי (דוגמה)', 'מפעיל', 'ייצור', '2025-01-01'),
  ('emp-t2', 'דנה כהן (דוגמה)', 'מלגזנית', 'מחסן', '2024-06-15') on conflict (id) do nothing;
insert into public.ncr (id, num, d, a, p, o, f, s, location_id) values
  ('ncr-t1', 'T-001', 'דוגמה: מעקה חסר במדרגות', 'בדיקת ניסוי', 'high', 'אחזקה', current_date + 14, 'open', 'loc-t1') on conflict (id) do nothing;
insert into public.tour_hazards (id, n, d, tour_no, dept, loc, descr, sev, resp, due, s) values
  ('th-t1', 1, current_date - 3, 1, 'חומר גלם', 'מתקן', 'דוגמה: כיסוי חסר על מנוע', 'בינונית', 'אחזקה', current_date + 10, 'פתוח') on conflict (id) do nothing;
insert into public.docs (id, n, c, e, s) values ('doc-t1', 'אישור דוגמה', 'כללי', current_date + 30, 'active') on conflict (id) do nothing;
insert into public.equip_inspections (id, code, n, loc, d, e, s) values
  ('eqi-t1', 'T-1', 'מלגזה (דוגמה)', 'מחסן', current_date - 300, current_date + 65, 'תקין') on conflict (id) do nothing;
insert into public.trustees (id, n, dep, active) values ('tru-t1', 'נאמן דוגמה', 'ייצור', true) on conflict (id) do nothing;
