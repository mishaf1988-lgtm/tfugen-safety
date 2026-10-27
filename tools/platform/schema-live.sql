-- dumped 2026-10-27 from the live project by tools/platform/schema-dump.sql; verified with schema-fingerprint.sql
create schema if not exists private;

create extension if not exists "uuid-ossp" with schema extensions;

create extension if not exists pg_cron;

create extension if not exists pg_net;

create extension if not exists pgcrypto with schema extensions;

create sequence if not exists public.audit_log_id_seq;

create sequence if not exists public.hist_id_seq;

create sequence if not exists public.item_links_id_seq;

create sequence if not exists public.ncr_ai_id_seq;

create sequence if not exists public.ncr_comments_id_seq;

create sequence if not exists public.ncr_patterns_id_seq;

create table if not exists private.anon_writes (uid uuid not null, tbl text not null, at timestamp with time zone default now() not null);

create table if not exists public.app_users (id text not null, username text not null, full_name text, email text, phone text, role text default 'מדווח'::text, dept text, active boolean default false, notes text, ts timestamp with time zone default now() not null);

create table if not exists public.audit_log (id bigint default nextval('audit_log_id_seq'::regclass) not null, ts timestamp with time zone default now() not null, user_email text, table_name text not null, record_id text, op text not null, title text, source text, changed text[]);

create table if not exists public.auds (id text not null, n text not null, a text, r text, d date, f integer default 0, sc integer, s text default 'planned'::text, f2 date, sm text, created_at timestamp with time zone default now());

create table if not exists public.ctr (id text not null, n text, ty text, c text, ph text, e text, tr text, s text, created_at timestamp with time zone default now(), file_url text);

create table if not exists public.custom_props (id text not null, entity_table text not null, entity_id text not null, k text not null, v text, ts timestamp with time zone default now() not null);

create table if not exists public.docs (id text not null, n text not null, c text, v text default '1.0'::text, o text, u date, e date, s text default 'active'::text, i text, nt text, created_at timestamp with time zone default now(), file_url text);

create table if not exists public.drl (id text not null, ty text, d text, p text, dur text, sc text, n text, created_at timestamp with time zone default now());

create table if not exists public.emp (id text not null, n text not null, r text, dep text, s date, eid text, ph text, created_at timestamp with time zone default now(), ext_id text, em text, left_d date);

create table if not exists public.env (id text not null, d text, ty text, me text, r text, u text, lim text, s text, created_at timestamp with time zone default now());

create table if not exists public.env_aspects (id text not null, aspect text not null, activity text, impact text, significance text, legal_ref text, controls text, owner text, review_date date, notes text, ts timestamp with time zone default now() not null, lifecycle text, control_type text, direction text, p_curr integer, sv_curr integer, additional_controls text, p_pot integer, sv_pot integer, status text, explanation text, file_url text);

create table if not exists public.equip_inspection_history (id text not null, equip_id text, inspection_date date, expiry_date date, next_inspection_date date, inspector text, report_number text, inspection_type text, status text, deficiencies text, notes text, file_url text, cycle_months integer, client_name text, vendor text, loc text, raw_json jsonb, ts timestamp with time zone default now(), license_number text, manufacturer text, model text, serial_number text, year_of_production smallint, inspector_certificate text, inspector_phone text, inspector_address text, work_pressure text, test_pressure text, approved_pressure text, internal_number text);

create table if not exists public.equip_inspections (id text not null, code text, n text not null, vendor text, loc text, d date, e date, s text default 'תקין'::text, notes text, ts timestamp with time zone default now() not null, photo_url text, ext_id text, location_id text, file_url text, status text, last_inspection_date date, report_number text, cycle_months integer, inspector text, inspection_type text, next_inspection_date date, deficiencies text, client_name text, previous_report_number text, license_number text, manufacturer text, model text, serial_number text, year_of_production smallint, inspector_certificate text, inspector_phone text, inspector_address text, work_pressure text, test_pressure text, approved_pressure text, internal_number text, category text, pdf_source_file text, pdf_source_page smallint, attachments jsonb, resp_area text);

create table if not exists public.files (id text not null, name text not null, size bigint, type text, ctx text, path text, ts timestamp with time zone default now());

create table if not exists public.hearing_tests (id text not null, emp_name text, emp_id text, dob date, age integer, gender text, role text, dept text, category text, year text, notes text, test_date date, inspector text, ts timestamp with time zone default now() not null, location_id text, e date);

create table if not exists public.hist (id bigint default nextval('hist_id_seq'::regclass) not null, ic text, tx text, ts timestamp with time zone default now());

create table if not exists public.hzm (id text not null, n text, un text, hs text, q text, loc text, ms text, em text, created_at timestamp with time zone default now(), location_id text, file_url text);

create table if not exists public.inc (id text not null, d text not null, dt timestamp with time zone, ty text, sv text, l text, w text, dy integer default 0, s text default 'open'::text, r text, p text, created_at timestamp with time zone default now(), file_url text, location_id text, project_id text, issue_type_id text, five_why text, dept text, dept_group text, reported boolean, src text, rc text);

create table if not exists public.ins (id text not null, d text, a text, i text, sc text, fn text, ac text, s text, created_at timestamp with time zone default now());

create table if not exists public.inspection_types (id text not null, name text not null, scope_table text, recur_count integer default 1 not null, recur_unit text default 'year'::text not null, next_due date, responsible text, notes text, active boolean default true not null, ts timestamp with time zone default now() not null);

create table if not exists public.issue_types (id text not null, name text not null, parent_id text, level smallint not null, category text, notes text, ts timestamp with time zone default now() not null);

create table if not exists public.item_links (id bigint not null, item_table text not null, item_id text not null, rel text not null, ref text not null, title text not null, at timestamp with time zone default now() not null, agent text not null);

create table if not exists public.leg (id text not null, s text, d text, a text, c text, u text, o text, created_at timestamp with time zone default now(), topic text, law_type text, law_num text, src_url text, summary text, full_text text, last_review date, c_date date, c_by text, c_evidence_url text);

create table if not exists public.locations (id text not null, name text not null, parent_id text, level smallint not null, notes text, ts timestamp with time zone default now() not null);

create table if not exists public.med (id text not null, w text, ty text, d text, e text, r text, n text, created_at timestamp with time zone default now(), ext_id text);

create table if not exists public.mgmt_reviews (id text not null, kind text not null, period text, content text not null, kpis text, created_by text, ts timestamp with time zone default now() not null, attendees text, decisions text);

create table if not exists public.ncr (id text not null, num text, d text not null, a text, p text default 'low'::text, o text, f date, u date, s text default 'open'::text, c text, created_at timestamp with time zone default now(), category text, cd date, sd date, loc text, root_cause text, immediate text, notes text, rc text, ts timestamp with time zone, ext_id text, sens boolean default false, verified_by text, verified_at timestamp with time zone, verification_notes text, location_id text, project_id text, issue_type_id text, five_why text, verification_result text, success_criteria text, rc_cat text);

create table if not exists public.ncr_ai (id bigint default nextval('ncr_ai_id_seq'::regclass) not null, ncr_id text not null, version integer default 1 not null, risk text, rc text, ia text, ca jsonb, prev text, owner_suggested text, due_suggested date, ts timestamp with time zone default now() not null, created_by text default 'ai'::text not null, feedback text, feedback_user text, feedback_ts timestamp with time zone);

create table if not exists public.ncr_comments (id bigint default nextval('ncr_comments_id_seq'::regclass) not null, ncr_id text not null, author text not null, text text not null, ts timestamp with time zone default now() not null);

create table if not exists public.ncr_patterns (id bigint default nextval('ncr_patterns_id_seq'::regclass) not null, ts timestamp with time zone default now() not null, content text not null, open_count integer, closed_count integer, by_area jsonb, by_priority jsonb, by_status jsonb, created_by text default 'admin'::text not null);

create table if not exists public.near_miss (id text not null, d date, t text, descr text not null, area text, rep text, sev text default 'קטין'::text, typ text, s text default 'פתוח'::text, notes text, ts timestamp with time zone default now() not null, photo_url text, location_id text, ncr_id text, notified_at timestamp with time zone, received_at timestamp with time zone default now());

create table if not exists public.notification_prefs (id text not null, prefs jsonb default '{}'::jsonb not null, ts timestamp with time zone default now() not null);

create table if not exists public.notifications_log (id text not null, user_email text, event_type text not null, channel text not null, payload jsonb, ts timestamp with time zone default now() not null);

create table if not exists public.oauth_tokens (provider text not null, user_email text not null, refresh_token text not null, access_token text, expires_at timestamp with time zone, scope text, updated_at timestamp with time zone default now() not null, created_at timestamp with time zone default now() not null);

create table if not exists public.page_files (id text not null, file_url text not null, file_name text, uploaded_by text, ts timestamp with time zone default now() not null);

create table if not exists public.password_reset_requests (id uuid default gen_random_uuid() not null, username text not null, status text default 'pending'::text not null, ts timestamp with time zone default now() not null, approved_by text, approved_at timestamp with time zone, notes text);

create table if not exists public.ppe (id text not null, ty text, w text, m text, d text, e text, c text, created_at timestamp with time zone default now(), ext_id text, file_url text);

create table if not exists public.projects (id text not null, name text not null, description text, start_date date, end_date date, status text default 'פעיל'::text, ts timestamp with time zone default now() not null);

create table if not exists public.ptw (id text not null, num text, con text, sup text, ph text, wkr text, area text, dep text, ds text, de text, ts text, te text, types text, safety text, sg1n text, sg1d text, created_at timestamp with time zone default now(), location_id text, "desc" text, s text, sg2n text, sg2d text, sg3n text, sg3d text, sg4n text, sg4d text, ver timestamp with time zone default now() not null);

create table if not exists public.record_history (id text not null, table_name text not null, record_id text not null, e_old date, e_new date, d_old date, note text, changed_by text, ts timestamp with time zone default now() not null);

create table if not exists public.rounds (id text not null, d date not null, inspector text, fire boolean default false, corridors boolean default false, ppe boolean default false, samples boolean default false, chemicals boolean default false, firstaid boolean default false, notes text, s text default 'חלקי'::text, ts timestamp with time zone default now() not null, theme text default 'morning'::text, items jsonb default '[]'::jsonb not null);

create table if not exists public.rsk (id text not null, d text not null, a text, o text, p integer default 3, sv integer default 3, ct text, ac text, created_at timestamp with time zone default now(), last_review date);

create table if not exists public.saved_views (id text not null, user_email text not null, page_slug text not null, name text not null, filters jsonb not null, ts timestamp with time zone default now() not null);

create table if not exists public.server_state (key text not null, value text, updated_at timestamp with time zone default now() not null);

create table if not exists public.talk_topics (id text not null, dept text not null, ord integer not null, title text not null, body text not null, quiz jsonb, active boolean default true not null, ts timestamp with time zone default now() not null);

create table if not exists public.tasks (id text not null, title text not null, assignee text, due date, status text default 'פתוח'::text, priority text default 'רגיל'::text, source_table text, source_id text, notes text, ts timestamp with time zone default now() not null, ext_id text, parent_id text, project_id text, closed_date date);

create table if not exists public.toolbox (id text not null, d date, topic text not null, presenter text, attendees text, s text default 'נמסרה'::text, notes text, file_url text, ts timestamp with time zone default now() not null, dep text, ext_id text);

create table if not exists public.toolbox_reads (id text not null, talk_id text not null, emp_id text, emp_name text not null, dept text, lang text, sig_url text, device text, read_at timestamp with time zone default now() not null, ts timestamp with time zone default now() not null, id_no text, text_hash text, mode text, quiz_ok smallint, quiz_n smallint, doc_url text, mailed_at timestamp with time zone, doc_err text, emp_no text, phone text, job text, agency text);

create table if not exists public.toolbox_talks (id text not null, d date, title text not null, body text, body_ar text, body_ru text, body_am text, file_url text, s text default 'טיוטה'::text not null, created_by text, ts timestamp with time zone default now() not null, link_at timestamp with time zone, trainer text, trainer_qual text, trainer_sig_url text, trainer_signed_at timestamp with time zone, eff_req boolean, eff_ok boolean, eff_d date, eff_desc text, eff_next text, eff_by text, video_url text, quiz jsonb, kind text, link_v smallint default 0 not null, dept text, topic_id text, dur text, mail_cc text, subjects text, form_at timestamp with time zone, closed_at timestamp with time zone);

create table if not exists public.tour_hazards (id text not null, n integer, d date, tour_no integer, dept text not null, loc text, location_id text, descr text not null, sev text, resp text, action text, due date, s text default 'פתוח'::text not null, closed_d date, notes text, photo_url text, ts timestamp with time zone default now() not null, resp2 text, closed_by text, close_note text, after_photo_url text, recheck_d date);

create table if not exists public.tr (id text not null, w text not null, n text not null, c text, tr_name text, d date, e date, sc integer, s text default 'completed'::text, sig boolean default false, created_at timestamp with time zone default now(), file_url text, ext_id text);

create table if not exists public.train_plan (id text not null, yr integer not null, n integer not null, t text not null, who text, aud text, q text, done jsonb default '[]'::jsonb not null, ts timestamp with time zone default now() not null);

create table if not exists public.trustee_reports (id text not null, u text not null, m text not null, t smallint not null, d date not null, location_id text, loc text, ok boolean default true not null, f text, photo_url text, s text default 'פתוח'::text not null, ref text, mgr_note text, ts timestamp with time zone default now() not null, tour text, notified_at timestamp with time zone, verified_by text, verified_at timestamp with time zone, action text, closed_d date, num integer, resp text, received_at timestamp with time zone default now());

create table if not exists public.trustee_tasks (id text not null, n smallint not null, icon text, t text not null, how text, active boolean default true not null, ts timestamp with time zone default now() not null);

create table if not exists public.trustee_winners (id text not null, m text not null, u text not null, pts integer, note text, ts timestamp with time zone default now() not null);

create table if not exists public.trustees (id text not null, n text not null, dep text, ph text, active boolean default true not null, notes text, ts timestamp with time zone default now() not null);

create table if not exists public.wst (id text not null, d text, ty text, q text, c text, h text, t text, created_at timestamp with time zone default now(), site text, cert text, file_url text);

alter table public.app_users add constraint app_users_pkey PRIMARY KEY (id);

alter table public.app_users add constraint app_users_username_key UNIQUE (username);

alter table public.audit_log add constraint audit_log_op_check CHECK ((op = ANY (ARRAY['ins'::text, 'upd'::text, 'del'::text])));

alter table public.audit_log add constraint audit_log_pkey PRIMARY KEY (id);

alter table public.auds add constraint auds_pkey PRIMARY KEY (id);

alter table public.ctr add constraint ctr_pkey PRIMARY KEY (id);

alter table public.custom_props add constraint custom_props_pkey PRIMARY KEY (id);

alter table public.docs add constraint docs_pkey PRIMARY KEY (id);

alter table public.drl add constraint drl_pkey PRIMARY KEY (id);

alter table public.emp add constraint emp_pkey PRIMARY KEY (id);

alter table public.env add constraint env_pkey PRIMARY KEY (id);

alter table public.env_aspects add constraint env_aspects_pkey PRIMARY KEY (id);

alter table public.equip_inspection_history add constraint equip_inspection_history_pkey PRIMARY KEY (id);

alter table public.equip_inspections add constraint equip_inspections_pkey PRIMARY KEY (id);

alter table public.files add constraint files_pkey PRIMARY KEY (id);

alter table public.hearing_tests add constraint hearing_tests_pkey PRIMARY KEY (id);

alter table public.hist add constraint hist_pkey PRIMARY KEY (id);

alter table public.hzm add constraint hzm_pkey PRIMARY KEY (id);

alter table public.inc add constraint inc_pkey PRIMARY KEY (id);

alter table public.ins add constraint ins_pkey PRIMARY KEY (id);

alter table public.inspection_types add constraint inspection_types_pkey PRIMARY KEY (id);

alter table public.issue_types add constraint issue_types_level_check CHECK (((level >= 1) AND (level <= 3)));

alter table public.issue_types add constraint issue_types_pkey PRIMARY KEY (id);

alter table public.item_links add constraint item_links_item_table_check CHECK ((item_table = ANY (ARRAY['equip_inspections'::text, 'docs'::text])));

alter table public.item_links add constraint item_links_item_table_item_id_rel_ref_key UNIQUE (item_table, item_id, rel, ref);

alter table public.item_links add constraint item_links_pkey PRIMARY KEY (id);

alter table public.item_links add constraint item_links_ref_check CHECK (((length(ref) >= 3) AND (length(ref) <= 600)));

alter table public.item_links add constraint item_links_rel_check CHECK ((rel = ANY (ARRAY['mail'::text, 'quote'::text, 'report'::text, 'order'::text, 'supplier'::text, 'file'::text])));

alter table public.item_links add constraint item_links_title_check CHECK (((length(title) >= 2) AND (length(title) <= 200)));

alter table public.leg add constraint leg_pkey PRIMARY KEY (id);

alter table public.locations add constraint locations_level_check CHECK (((level >= 1) AND (level <= 3)));

alter table public.locations add constraint locations_pkey PRIMARY KEY (id);

alter table public.med add constraint med_pkey PRIMARY KEY (id);

alter table public.mgmt_reviews add constraint mgmt_reviews_pkey PRIMARY KEY (id);

alter table public.ncr add constraint ncr_pkey PRIMARY KEY (id);

alter table public.ncr_ai add constraint ncr_ai_feedback_chk CHECK (((feedback IS NULL) OR (feedback = ANY (ARRAY['up'::text, 'down'::text]))));

alter table public.ncr_ai add constraint ncr_ai_pkey PRIMARY KEY (id);

alter table public.ncr_comments add constraint ncr_comments_pkey PRIMARY KEY (id);

alter table public.ncr_patterns add constraint ncr_patterns_pkey PRIMARY KEY (id);

alter table public.near_miss add constraint near_miss_pkey PRIMARY KEY (id);

alter table public.notification_prefs add constraint notification_prefs_pkey PRIMARY KEY (id);

alter table public.notifications_log add constraint notifications_log_pkey PRIMARY KEY (id);

alter table public.oauth_tokens add constraint oauth_tokens_pkey PRIMARY KEY (provider, user_email);

alter table public.page_files add constraint page_files_pkey PRIMARY KEY (id);

alter table public.password_reset_requests add constraint password_reset_requests_pkey PRIMARY KEY (id);

alter table public.password_reset_requests add constraint password_reset_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'denied'::text])));

alter table public.ppe add constraint ppe_pkey PRIMARY KEY (id);

alter table public.projects add constraint projects_pkey PRIMARY KEY (id);

alter table public.ptw add constraint ptw_pkey PRIMARY KEY (id);

alter table public.record_history add constraint record_history_pkey PRIMARY KEY (id);

alter table public.rounds add constraint rounds_pkey PRIMARY KEY (id);

alter table public.rsk add constraint rsk_pkey PRIMARY KEY (id);

alter table public.saved_views add constraint saved_views_pkey PRIMARY KEY (id);

alter table public.server_state add constraint server_state_pkey PRIMARY KEY (key);

alter table public.talk_topics add constraint talk_topics_pkey PRIMARY KEY (id);

alter table public.tasks add constraint tasks_pkey PRIMARY KEY (id);

alter table public.toolbox add constraint toolbox_pkey PRIMARY KEY (id);

alter table public.toolbox_reads add constraint toolbox_reads_pkey PRIMARY KEY (id);

alter table public.toolbox_talks add constraint toolbox_talks_pkey PRIMARY KEY (id);

alter table public.tour_hazards add constraint tour_hazards_pkey PRIMARY KEY (id);

alter table public.tr add constraint tr_pkey PRIMARY KEY (id);

alter table public.train_plan add constraint train_plan_pkey PRIMARY KEY (id);

alter table public.train_plan add constraint train_plan_yr_n_key UNIQUE (yr, n);

alter table public.trustee_reports add constraint trustee_reports_photo_url_check CHECK (((photo_url IS NULL) OR (photo_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/incidents-photos/tru-[A-Za-z0-9._-]{1,250}$'::text) OR ((photo_url ~ '^pending:'::text) AND (length(photo_url) <= 300))));

alter table public.trustee_reports add constraint trustee_reports_pkey PRIMARY KEY (id);

alter table public.trustee_reports add constraint trustee_reports_t_check CHECK (((t >= 1) AND (t <= 20)));

alter table public.trustee_tasks add constraint trustee_tasks_n_key UNIQUE (n);

alter table public.trustee_tasks add constraint trustee_tasks_pkey PRIMARY KEY (id);

alter table public.trustee_winners add constraint trustee_winners_m_key UNIQUE (m);

alter table public.trustee_winners add constraint trustee_winners_pkey PRIMARY KEY (id);

alter table public.trustees add constraint trustees_pkey PRIMARY KEY (id);

alter table public.wst add constraint wst_pkey PRIMARY KEY (id);

alter table public.equip_inspection_history add constraint equip_inspection_history_equip_id_fkey FOREIGN KEY (equip_id) REFERENCES equip_inspections(id) ON DELETE SET NULL;

alter table public.equip_inspections add constraint equip_inspections_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

alter table public.hearing_tests add constraint hearing_tests_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

alter table public.hzm add constraint hzm_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

alter table public.inc add constraint inc_issue_type_id_fkey FOREIGN KEY (issue_type_id) REFERENCES issue_types(id) ON DELETE SET NULL;

alter table public.inc add constraint inc_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

alter table public.inc add constraint inc_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

alter table public.issue_types add constraint issue_types_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES issue_types(id) ON DELETE RESTRICT;

alter table public.locations add constraint locations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES locations(id) ON DELETE RESTRICT;

alter table public.ncr add constraint ncr_issue_type_id_fkey FOREIGN KEY (issue_type_id) REFERENCES issue_types(id) ON DELETE SET NULL;

alter table public.ncr add constraint ncr_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

alter table public.ncr add constraint ncr_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

alter table public.near_miss add constraint near_miss_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

alter table public.ptw add constraint ptw_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

alter table public.tasks add constraint tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

alter table public.toolbox_reads add constraint toolbox_reads_talk_id_fkey FOREIGN KEY (talk_id) REFERENCES toolbox_talks(id);

CREATE INDEX anon_writes_at_idx ON private.anon_writes USING btree (at);

CREATE INDEX anon_writes_uid_at_idx ON private.anon_writes USING btree (uid, at);

CREATE INDEX app_users_active_idx ON public.app_users USING btree (active);

CREATE INDEX app_users_username_idx ON public.app_users USING btree (username);

CREATE INDEX audit_log_table_record_idx ON public.audit_log USING btree (table_name, record_id);

CREATE INDEX audit_log_ts_idx ON public.audit_log USING btree (ts DESC);

CREATE INDEX audit_log_user_idx ON public.audit_log USING btree (user_email);

CREATE INDEX custom_props_entity_idx ON public.custom_props USING btree (entity_table, entity_id);

CREATE INDEX emp_ext_id_idx ON public.emp USING btree (ext_id) WHERE (ext_id IS NOT NULL);

CREATE INDEX env_aspects_review_idx ON public.env_aspects USING btree (review_date) WHERE (review_date IS NOT NULL);

CREATE INDEX env_aspects_sig_idx ON public.env_aspects USING btree (significance) WHERE (significance IS NOT NULL);

CREATE INDEX equip_inspection_history_equip_id_idx ON public.equip_inspection_history USING btree (equip_id);

CREATE INDEX equip_inspection_history_report_number_idx ON public.equip_inspection_history USING btree (report_number) WHERE (report_number IS NOT NULL);

CREATE INDEX equip_inspection_history_ts_idx ON public.equip_inspection_history USING btree (ts DESC);

CREATE INDEX equip_inspections_code_idx ON public.equip_inspections USING btree (code);

CREATE INDEX equip_inspections_e_idx ON public.equip_inspections USING btree (e);

CREATE INDEX equip_inspections_ext_id_idx ON public.equip_inspections USING btree (ext_id) WHERE (ext_id IS NOT NULL);

CREATE INDEX equip_inspections_location_idx ON public.equip_inspections USING btree (location_id) WHERE (location_id IS NOT NULL);

CREATE INDEX hearing_tests_emp_idx ON public.hearing_tests USING btree (emp_id);

CREATE INDEX hearing_tests_location_idx ON public.hearing_tests USING btree (location_id) WHERE (location_id IS NOT NULL);

CREATE INDEX hearing_tests_test_date_idx ON public.hearing_tests USING btree (test_date);

CREATE INDEX hzm_location_idx ON public.hzm USING btree (location_id) WHERE (location_id IS NOT NULL);

CREATE INDEX inc_issue_type_idx ON public.inc USING btree (issue_type_id) WHERE (issue_type_id IS NOT NULL);

CREATE INDEX inc_location_idx ON public.inc USING btree (location_id) WHERE (location_id IS NOT NULL);

CREATE INDEX inc_project_idx ON public.inc USING btree (project_id) WHERE (project_id IS NOT NULL);

CREATE INDEX inspection_types_due_idx ON public.inspection_types USING btree (next_due) WHERE (active = true);

CREATE INDEX issue_types_level_idx ON public.issue_types USING btree (level);

CREATE INDEX issue_types_parent_idx ON public.issue_types USING btree (parent_id) WHERE (parent_id IS NOT NULL);

CREATE INDEX item_links_item ON public.item_links USING btree (item_table, item_id);

CREATE INDEX leg_a_idx ON public.leg USING btree (a);

CREATE INDEX leg_topic_idx ON public.leg USING btree (topic);

CREATE INDEX locations_level_idx ON public.locations USING btree (level);

CREATE INDEX locations_parent_idx ON public.locations USING btree (parent_id) WHERE (parent_id IS NOT NULL);

CREATE INDEX med_ext_id_idx ON public.med USING btree (ext_id) WHERE (ext_id IS NOT NULL);

CREATE INDEX mgmt_reviews_ts_idx ON public.mgmt_reviews USING btree (ts DESC);

CREATE INDEX ncr_ai_ncr_id_idx ON public.ncr_ai USING btree (ncr_id);

CREATE INDEX ncr_ai_ncr_id_version_idx ON public.ncr_ai USING btree (ncr_id, version DESC);

CREATE INDEX ncr_comments_ncr_id_ts_idx ON public.ncr_comments USING btree (ncr_id, ts DESC);

CREATE INDEX ncr_ext_id_idx ON public.ncr USING btree (ext_id) WHERE (ext_id IS NOT NULL);

CREATE INDEX ncr_issue_type_idx ON public.ncr USING btree (issue_type_id) WHERE (issue_type_id IS NOT NULL);

CREATE INDEX ncr_location_idx ON public.ncr USING btree (location_id) WHERE (location_id IS NOT NULL);

CREATE INDEX ncr_patterns_ts_idx ON public.ncr_patterns USING btree (ts DESC);

CREATE INDEX ncr_project_idx ON public.ncr USING btree (project_id) WHERE (project_id IS NOT NULL);

CREATE INDEX ncr_rc_cat_idx ON public.ncr USING btree (rc_cat);

CREATE INDEX ncr_sens_idx ON public.ncr USING btree (sens) WHERE (sens = true);

CREATE INDEX ncr_verified_at_idx ON public.ncr USING btree (verified_at) WHERE (verified_at IS NOT NULL);

CREATE INDEX near_miss_d_idx ON public.near_miss USING btree (d);

CREATE INDEX near_miss_location_idx ON public.near_miss USING btree (location_id) WHERE (location_id IS NOT NULL);

CREATE INDEX near_miss_s_idx ON public.near_miss USING btree (s);

CREATE INDEX notifications_log_event_idx ON public.notifications_log USING btree (event_type);

CREATE INDEX notifications_log_user_idx ON public.notifications_log USING btree (user_email);

CREATE INDEX password_reset_requests_status_ts_idx ON public.password_reset_requests USING btree (status, ts DESC);

CREATE INDEX ppe_ext_id_idx ON public.ppe USING btree (ext_id) WHERE (ext_id IS NOT NULL);

CREATE INDEX projects_status_idx ON public.projects USING btree (status);

CREATE INDEX ptw_location_idx ON public.ptw USING btree (location_id) WHERE (location_id IS NOT NULL);

CREATE INDEX record_history_entity_idx ON public.record_history USING btree (table_name, record_id, ts DESC);

CREATE INDEX rounds_d_idx ON public.rounds USING btree (d);

CREATE INDEX saved_views_user_page_idx ON public.saved_views USING btree (user_email, page_slug);

CREATE INDEX tasks_due_idx ON public.tasks USING btree (due);

CREATE INDEX tasks_ext_id_idx ON public.tasks USING btree (ext_id) WHERE (ext_id IS NOT NULL);

CREATE INDEX tasks_parent_id_idx ON public.tasks USING btree (parent_id) WHERE (parent_id IS NOT NULL);

CREATE INDEX tasks_project_idx ON public.tasks USING btree (project_id) WHERE (project_id IS NOT NULL);

CREATE INDEX tasks_source_idx ON public.tasks USING btree (source_table, source_id);

CREATE INDEX tasks_status_idx ON public.tasks USING btree (status);

CREATE INDEX toolbox_d_idx ON public.toolbox USING btree (d);

CREATE INDEX toolbox_ext_id_idx ON public.toolbox USING btree (ext_id) WHERE (ext_id IS NOT NULL);

CREATE UNIQUE INDEX toolbox_reads_talk_emp_uq ON public.toolbox_reads USING btree (talk_id, emp_id);

CREATE INDEX toolbox_reads_talk_id_idx ON public.toolbox_reads USING btree (talk_id);

CREATE INDEX toolbox_ts_idx ON public.toolbox USING btree (ts);

CREATE INDEX tr_ext_id_idx ON public.tr USING btree (ext_id) WHERE (ext_id IS NOT NULL);

CREATE INDEX trustee_reports_d_idx ON public.trustee_reports USING btree (d);

CREATE INDEX trustee_reports_m_idx ON public.trustee_reports USING btree (m);

CREATE UNIQUE INDEX trustee_reports_num_uq ON public.trustee_reports USING btree (num) WHERE (num IS NOT NULL);

CREATE INDEX trustee_reports_ref_idx ON public.trustee_reports USING btree (ref) WHERE (ref IS NOT NULL);

CREATE INDEX trustee_reports_ts_idx ON public.trustee_reports USING btree (ts);

CREATE OR REPLACE FUNCTION private.anon_users_cleanup()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;
begin
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '30 days'
    and not exists (
      select 1 from auth.sessions s
      where s.user_id = u.id
        and coalesce(s.refreshed_at, s.updated_at, s.created_at) > now() - interval '30 days')
    and not exists (
      select 1 from storage.objects o
      where o.owner = u.id or o.owner_id = u.id::text);
  get diagnostics n = row_count;
  return n;
end;
$function$;

CREATE OR REPLACE FUNCTION private.anon_write_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid  uuid := auth.uid();
  n_me   int;
  n_all  int;
BEGIN
  IF v_uid IS NULL OR coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private.anon_write_cap'));
  DELETE FROM private.anon_writes WHERE at < now() - interval '2 hours';
  SELECT count(*) FILTER (WHERE a.uid = v_uid), count(*)
    INTO n_me, n_all
    FROM private.anon_writes a
   WHERE a.at > now() - interval '1 hour';
  IF n_me >= 60 OR n_all >= 200 THEN
    RAISE SQLSTATE 'PT429' USING
      MESSAGE = 'יותר מדי דיווחים בשעה האחרונה. הדיווח נשמר בטלפון ויישלח שוב אוטומטית.',
      DETAIL  = CASE WHEN n_me >= 60 THEN 'anon cap: session 60/hour' ELSE 'anon cap: all sessions 200/hour' END;
  END IF;
  INSERT INTO private.anon_writes (uid, tbl) VALUES (v_uid, TG_TABLE_NAME);
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION private.audit_log_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE j jsonb := auth.jwt();
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF j IS NULL OR j->>'role' = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.table_name = ANY (private.audit_tables()) THEN RETURN NULL; END IF;
  NEW.ts := now();
  NEW.user_email := coalesce(nullif(j->>'email', ''), 'anonymous');
  NEW.source := 'app';
  NEW.changed := NULL;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.audit_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  j jsonb := auth.jwt();
  who text; src text; o jsonb; n jsonb; r jsonb; ch text[];
BEGIN
  IF j IS NULL THEN who := 'db'; src := 'db';
  ELSIF j->>'role' = 'service_role' THEN who := 'server'; src := 'server';
  ELSE who := coalesce(nullif(j->>'email', ''), 'anonymous'); src := 'app';
  END IF;

  IF TG_OP <> 'INSERT' THEN o := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN n := to_jsonb(NEW); END IF;
  r := coalesce(n, o);

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(k ORDER BY k) INTO ch
      FROM jsonb_object_keys(n) k
     WHERE k NOT IN ('ts', 'notified_at') AND (o->k) IS DISTINCT FROM (n->k);
    IF ch IS NULL THEN RETURN NULL; END IF;
  END IF;

  INSERT INTO public.audit_log (user_email, table_name, record_id, op, title, source, changed)
  VALUES (who, TG_TABLE_NAME, r->>'id',
          CASE TG_OP WHEN 'INSERT' THEN 'ins' WHEN 'UPDATE' THEN 'upd' ELSE 'del' END,
          left(coalesce(r->>'title', r->>'topic', r->>'descr', r->>'f', r->>'num', r->>'n',
                        r->>'period', r->>'d'), 80),
          src, ch);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION private.audit_tables()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ SELECT ARRAY['tour_hazards','trustee_reports','inc','ncr','near_miss','tasks',
                   'equip_inspections','docs','tr','mgmt_reviews','leg']::text[] $function$;

CREATE OR REPLACE FUNCTION private.backup_od_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s text;
begin
  if extract(hour from (now() at time zone 'Asia/Jerusalem')) <> 6 then return; end if;
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/backup-od',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 60000
  );
end
$function$;

CREATE OR REPLACE FUNCTION private.clear_must_change_password()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password
     AND NEW.raw_app_meta_data ? 'must_change_password' THEN
    NEW.raw_app_meta_data := NEW.raw_app_meta_data - 'must_change_password';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION private.db_columns_check()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cur jsonb; snap jsonb; added jsonb; removed jsonb; res jsonb;
begin
  select coalesce(jsonb_agg(c order by c), '[]'::jsonb) into cur
    from (select table_name || '.' || column_name as c
            from information_schema.columns where table_schema = 'public') x;
  select value::jsonb into snap from public.server_state where key = 'db_columns_snapshot';
  if snap is null then
    insert into public.server_state(key, value, updated_at) values ('db_columns_snapshot', cur::text, now())
      on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
    snap := cur;
  end if;
  select coalesce(jsonb_agg(e order by e), '[]'::jsonb) into added
    from jsonb_array_elements_text(cur) e where not snap ? e;
  select coalesce(jsonb_agg(e order by e), '[]'::jsonb) into removed
    from jsonb_array_elements_text(snap) e where not cur ? e;
  res := jsonb_build_object('at', now(), 'added', added, 'removed', removed);
  insert into public.server_state(key, value, updated_at) values ('db_columns_drift', res::text, now())
    on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  return res;
end
$function$;

CREATE OR REPLACE FUNCTION private.hazard_file_ping()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s text;
begin
  begin
    select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
    perform net.http_post(
      url := 'https://tapugan-safety.pages.dev/api/hazard-file',
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
      timeout_milliseconds := 30000
    );
  exception when others then
    null;
  end;
end
$function$;

CREATE OR REPLACE FUNCTION private.hazard_file_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.hazard_file_ping();
  return null;
end
$function$;

CREATE OR REPLACE FUNCTION private.is_admin_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT auth.jwt() ->> 'email' = 'admin@tfugen.local' OR EXISTS (SELECT 1 FROM public.app_users u WHERE auth.jwt() ->> 'email' = u.id || '@tfugen.local' AND u.role IN ('אדמין','מנהל') AND u.active IS NOT FALSE); $function$;

CREATE OR REPLACE FUNCTION private.is_admin_only()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT auth.jwt() ->> 'email' = 'admin@tfugen.local' OR EXISTS (SELECT 1 FROM public.app_users u WHERE auth.jwt() ->> 'email' = u.id || '@tfugen.local' AND u.role = 'אדמין' AND u.active IS NOT FALSE); $function$;

CREATE OR REPLACE FUNCTION private.is_viewer()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.app_users u WHERE auth.jwt() ->> 'email' = u.id || '@tfugen.local' AND u.role = 'צופה' AND u.active IS NOT FALSE); $function$;

CREATE OR REPLACE FUNCTION private.mail_inbox_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/mail-inbox',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 25000
  );
end
$function$;

CREATE OR REPLACE FUNCTION private.mfa_ok()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      OR NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors f
         WHERE f.user_id = auth.uid() AND f.status = 'verified'
      );
$function$;

CREATE OR REPLACE FUNCTION private.near_miss_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO s FROM vault.decrypted_secrets WHERE name = 'trustee_notify_secret' LIMIT 1;
    PERFORM net.http_post(
      url := 'https://tapugan-safety.pages.dev/api/trustee-notify',
      body := jsonb_build_object('id', NEW.id, 'src', 'near_miss'),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
      timeout_milliseconds := 8000
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION private.od_scan_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/od-scan',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 60000
  );
end
$function$;

CREATE OR REPLACE FUNCTION private.protect_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'protect_delete: TRUNCATE of % is blocked', tg_table_name;
  end if;
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated' and private.is_admin_manager() then
    return old;
  end if;
  raise exception 'protect_delete: deleting from % is allowed only to an app admin', tg_table_name;
end
$function$;

CREATE OR REPLACE FUNCTION private.ptw_ver()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ BEGIN NEW.ver := clock_timestamp(); RETURN NEW; END $function$;

CREATE OR REPLACE FUNCTION private.talk_week(p_day date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d date := coalesce(p_day, (now() at time zone 'Asia/Jerusalem')::date);
  nid text := 'w' || to_char(coalesce(p_day, (now() at time zone 'Asia/Jerusalem')::date), 'YYYYMMDD');
  v_body text;
  v_tr text;
  v_q text;
begin
  if exists (select 1 from public.toolbox_talks k where k.id = nid) then
    return '[]'::jsonb;
  end if;
  select string_agg('## ' || x.dept || E'\n' || x.txt, E'\n\n' order by x.dept) into v_body
    from (select t.dept, string_agg(t.title || E'\n' || t.body, E'\n\n' order by t.ord) txt
            from public.talk_topics t where t.active group by t.dept) x;
  if v_body is null then
    return '[]'::jsonb;
  end if;
  select k.trainer, k.trainer_qual into v_tr, v_q from public.toolbox_talks k
    where k.kind is null and k.trainer is not null order by k.ts desc limit 1;
  insert into public.toolbox_talks (id, d, title, body, s, kind, dept, trainer, trainer_qual, created_by, ts)
    values (nid, d, 'הדרכה שבועית ' || to_char(d, 'DD/MM/YYYY'), v_body, 'טיוטה', null, null, v_tr, v_q, 'routine', now());
  insert into public.server_state(key, value, updated_at)
    values ('talk_week', jsonb_build_object('at', now(), 'day', d, 'made', jsonb_build_array(nid))::text, now())
    on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  return jsonb_build_array(nid);
end
$function$;

CREATE OR REPLACE FUNCTION private.trustee_log_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/trustee-log',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 20000
  );
end
$function$;

CREATE OR REPLACE FUNCTION private.trustee_reports_before_ins()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.m IS NULL OR NEW.m = '' THEN
    NEW.m := to_char(NEW.d, 'YYYY-MM');
  END IF;
  IF NEW.ok AND (NEW.s IS NULL OR NEW.s = '' OR NEW.s = 'פתוח') THEN
    NEW.s := 'תקין';
  END IF;
  IF NOT NEW.ok AND (NEW.s IS NULL OR NEW.s = '' OR NEW.s = 'תקין') THEN
    NEW.s := 'פתוח';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION private.trustee_reports_close_ref()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.t = 8 AND NEW.ref IS NOT NULL AND NEW.ref <> '' THEN
    UPDATE public.trustee_reports
       SET s = 'נסגר', closed_d = COALESCE(closed_d, NEW.d)
     WHERE id = NEW.ref
       AND ok = false
       AND t BETWEEN 1 AND 20 AND t <> 8
       AND s <> 'נסגר'
       AND u IS NOT DISTINCT FROM NEW.u;
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION private.trustee_reports_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO s FROM vault.decrypted_secrets WHERE name = 'trustee_notify_secret' LIMIT 1;
    PERFORM net.http_post(
      url := 'https://tapugan-safety.pages.dev/api/trustee-log',
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
      timeout_milliseconds := 20000
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION private.trustee_reports_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s text;
BEGIN
  IF NEW.ok = false THEN
    BEGIN
      SELECT decrypted_secret INTO s FROM vault.decrypted_secrets WHERE name = 'trustee_notify_secret' LIMIT 1;
      PERFORM net.http_post(
        url := 'https://tapugan-safety.pages.dev/api/trustee-notify',
        body := jsonb_build_object('id', NEW.id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
        timeout_milliseconds := 8000
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;   -- a webhook hiccup must never block the trustee's report
    END;
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION private.trustee_reports_num()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.num := OLD.num;
  ELSE
    NEW.num := NULL;
  END IF;
  IF NEW.num IS NULL AND NEW.ok = false AND NEW.t BETWEEN 1 AND 20 AND NEW.t <> 8 THEN
    PERFORM pg_advisory_xact_lock(hashtext('trustee_reports.num'));
    SELECT coalesce(max(num), 0) + 1 INTO NEW.num FROM public.trustee_reports;
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION private.vitre_sync_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s text;
begin
  if extract(hour from (now() at time zone 'Asia/Jerusalem')) <> 6 then return; end if;
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/vitre?op=sync',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 60000
  );
end
$function$;

CREATE OR REPLACE FUNCTION private.wa_morning_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/wa-morning',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 60000
  );
end
$function$;

CREATE OR REPLACE FUNCTION private.wa_watch_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/wa-morning',
    body := '{"watch": true}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 30000
  );
end
$function$;

CREATE OR REPLACE FUNCTION private.weather_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/weather?op=check',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 60000
  );
end
$function$;

CREATE OR REPLACE FUNCTION private.weekly_digest_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s text;
begin
  if extract(hour from (now() at time zone 'Asia/Jerusalem')) <> 7 then return; end if;
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/weekly-digest',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 60000
  );
end
$function$;

CREATE OR REPLACE FUNCTION private.xlsx_gaps_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
  perform net.http_post(
    url := 'https://tapugan-safety.pages.dev/api/xlsx-gaps',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
    timeout_milliseconds := 60000
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.cancel_orphan_tasks_on_equip_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.tasks
     SET status = 'הושלם',
         notes  = COALESCE(notes,'') || E'\n[auto] בוטל ב-' || to_char(now() AT TIME ZONE 'Asia/Jerusalem','DD/MM/YYYY HH24:MI') || ' — הציוד נמחק'
   WHERE source_table = 'equip_inspections'
     AND source_id    = OLD.id
     AND status       = 'פתוח';
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.equip_inspections_alias_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status IS NOT NULL AND (NEW.s IS NULL OR NEW.s = '') THEN NEW.s := NEW.status; END IF;
  IF NEW.last_inspection_date IS NOT NULL AND NEW.d IS NULL THEN NEW.d := NEW.last_inspection_date; END IF;
  -- Keep alias columns NULL after copying so they don't drift.
  NEW.status := NULL;
  NEW.last_inspection_date := NULL;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.guess_clear(p_key text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update server_state set value = '0' where key = p_key and key like 'guess:%';
$function$;

CREATE OR REPLACE FUNCTION public.guess_hit(p_key text, p_window_s integer DEFAULT 3600)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int;
begin
  if p_key !~ '^guess:[a-z]{2,8}:[0-9a-f]{8,64}$' then raise exception 'bad key'; end if;
  insert into server_state(key, value, updated_at) values (p_key, '1', now())
  on conflict (key) do update set
    value = case when server_state.updated_at < now() - make_interval(secs => p_window_s) or server_state.value = '0' then '1'
                 else (coalesce(nullif(server_state.value, ''), '0')::int + 1)::text end,
    updated_at = case when server_state.updated_at < now() - make_interval(secs => p_window_s) or server_state.value = '0' then now()
                      else server_state.updated_at end
  returning value::int into n;
  return n;
end;
$function$;

CREATE OR REPLACE FUNCTION public.net_recent_errors(minutes integer DEFAULT 60)
 RETURNS TABLE(code text, n bigint, last timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(substring(r.content from 'error code: (\d+)'), r.status_code::text, 'none') as code,
         count(*) as n, max(r.created) as last
  from net._http_response r
  where r.created > now() - make_interval(mins => least(greatest(minutes, 5), 1440))
    and (r.status_code is null or r.status_code >= 500)
  group by 1
  order by 2 desc
  limit 5;
$function$;

CREATE TRIGGER clear_must_change_password BEFORE UPDATE OF encrypted_password ON auth.users FOR EACH ROW EXECUTE FUNCTION private.clear_must_change_password();

CREATE TRIGGER audit_log_stamp BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION private.audit_log_stamp();

CREATE TRIGGER zz_audit_row AFTER INSERT OR DELETE OR UPDATE ON public.docs FOR EACH ROW EXECUTE FUNCTION private.audit_row();

CREATE TRIGGER a_anon_write_cap BEFORE INSERT ON public.equip_inspections FOR EACH ROW EXECUTE FUNCTION private.anon_write_cap();

CREATE TRIGGER trg_eqi_alias_sync BEFORE INSERT OR UPDATE ON public.equip_inspections FOR EACH ROW EXECUTE FUNCTION equip_inspections_alias_sync();

CREATE TRIGGER trg_equip_delete_cancel_tasks AFTER DELETE ON public.equip_inspections FOR EACH ROW EXECUTE FUNCTION cancel_orphan_tasks_on_equip_delete();

CREATE TRIGGER zz_audit_row AFTER INSERT OR DELETE OR UPDATE ON public.equip_inspections FOR EACH ROW EXECUTE FUNCTION private.audit_row();

CREATE TRIGGER zz_audit_row AFTER INSERT OR DELETE OR UPDATE ON public.inc FOR EACH ROW EXECUTE FUNCTION private.audit_row();

CREATE TRIGGER zz_audit_row AFTER INSERT OR DELETE OR UPDATE ON public.leg FOR EACH ROW EXECUTE FUNCTION private.audit_row();

CREATE TRIGGER zz_audit_row AFTER INSERT OR DELETE OR UPDATE ON public.mgmt_reviews FOR EACH ROW EXECUTE FUNCTION private.audit_row();

CREATE TRIGGER protect_delete_row BEFORE DELETE ON public.ncr FOR EACH ROW EXECUTE FUNCTION private.protect_delete();

CREATE TRIGGER protect_delete_stmt BEFORE TRUNCATE ON public.ncr FOR EACH STATEMENT EXECUTE FUNCTION private.protect_delete();

CREATE TRIGGER zz_audit_row AFTER INSERT OR DELETE OR UPDATE ON public.ncr FOR EACH ROW EXECUTE FUNCTION private.audit_row();

CREATE TRIGGER protect_delete_row BEFORE DELETE ON public.ncr_ai FOR EACH ROW EXECUTE FUNCTION private.protect_delete();

CREATE TRIGGER protect_delete_stmt BEFORE TRUNCATE ON public.ncr_ai FOR EACH STATEMENT EXECUTE FUNCTION private.protect_delete();

CREATE TRIGGER a_anon_write_cap BEFORE INSERT ON public.near_miss FOR EACH ROW EXECUTE FUNCTION private.anon_write_cap();

CREATE TRIGGER near_miss_notify AFTER INSERT ON public.near_miss FOR EACH ROW EXECUTE FUNCTION private.near_miss_notify();

CREATE TRIGGER zz_audit_row AFTER INSERT OR DELETE OR UPDATE ON public.near_miss FOR EACH ROW EXECUTE FUNCTION private.audit_row();

CREATE TRIGGER ptw_ver BEFORE INSERT OR UPDATE ON public.ptw FOR EACH ROW EXECUTE FUNCTION private.ptw_ver();

CREATE TRIGGER a_anon_write_cap BEFORE INSERT ON public.rounds FOR EACH ROW EXECUTE FUNCTION private.anon_write_cap();

CREATE TRIGGER zz_audit_row AFTER INSERT OR DELETE OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION private.audit_row();

CREATE TRIGGER tour_hazards_file AFTER INSERT OR DELETE OR UPDATE ON public.tour_hazards FOR EACH STATEMENT EXECUTE FUNCTION private.hazard_file_trg();

CREATE TRIGGER zz_audit_row AFTER INSERT OR DELETE OR UPDATE ON public.tour_hazards FOR EACH ROW EXECUTE FUNCTION private.audit_row();

CREATE TRIGGER a_anon_write_cap BEFORE INSERT ON public.tr FOR EACH ROW EXECUTE FUNCTION private.anon_write_cap();

CREATE TRIGGER zz_audit_row AFTER INSERT OR DELETE OR UPDATE ON public.tr FOR EACH ROW EXECUTE FUNCTION private.audit_row();

CREATE TRIGGER a_anon_write_cap BEFORE INSERT ON public.trustee_reports FOR EACH ROW EXECUTE FUNCTION private.anon_write_cap();

CREATE TRIGGER protect_delete_row BEFORE DELETE ON public.trustee_reports FOR EACH ROW EXECUTE FUNCTION private.protect_delete();

CREATE TRIGGER protect_delete_stmt BEFORE TRUNCATE ON public.trustee_reports FOR EACH STATEMENT EXECUTE FUNCTION private.protect_delete();

CREATE TRIGGER trustee_reports_before_ins BEFORE INSERT ON public.trustee_reports FOR EACH ROW EXECUTE FUNCTION private.trustee_reports_before_ins();

CREATE TRIGGER trustee_reports_close_ref AFTER INSERT ON public.trustee_reports FOR EACH ROW EXECUTE FUNCTION private.trustee_reports_close_ref();

CREATE TRIGGER trustee_reports_file AFTER INSERT OR UPDATE ON public.trustee_reports FOR EACH STATEMENT EXECUTE FUNCTION private.hazard_file_trg();

CREATE TRIGGER trustee_reports_log AFTER INSERT OR UPDATE ON public.trustee_reports FOR EACH STATEMENT EXECUTE FUNCTION private.trustee_reports_log();

CREATE TRIGGER trustee_reports_notify AFTER INSERT ON public.trustee_reports FOR EACH ROW EXECUTE FUNCTION private.trustee_reports_notify();

CREATE TRIGGER trustee_reports_num_ins BEFORE INSERT ON public.trustee_reports FOR EACH ROW EXECUTE FUNCTION private.trustee_reports_num();

CREATE TRIGGER trustee_reports_num_upd BEFORE UPDATE ON public.trustee_reports FOR EACH ROW EXECUTE FUNCTION private.trustee_reports_num();

CREATE TRIGGER zz_audit_row AFTER INSERT OR DELETE OR UPDATE ON public.trustee_reports FOR EACH ROW EXECUTE FUNCTION private.audit_row();

alter table private.anon_writes enable row level security;

alter table public.app_users enable row level security;

alter table public.audit_log enable row level security;

alter table public.auds enable row level security;

alter table public.ctr enable row level security;

alter table public.custom_props enable row level security;

alter table public.docs enable row level security;

alter table public.drl enable row level security;

alter table public.emp enable row level security;

alter table public.env enable row level security;

alter table public.env_aspects enable row level security;

alter table public.equip_inspection_history enable row level security;

alter table public.equip_inspections enable row level security;

alter table public.files enable row level security;

alter table public.hearing_tests enable row level security;

alter table public.hist enable row level security;

alter table public.hzm enable row level security;

alter table public.inc enable row level security;

alter table public.ins enable row level security;

alter table public.inspection_types enable row level security;

alter table public.issue_types enable row level security;

alter table public.item_links enable row level security;

alter table public.leg enable row level security;

alter table public.locations enable row level security;

alter table public.med enable row level security;

alter table public.mgmt_reviews enable row level security;

alter table public.ncr enable row level security;

alter table public.ncr_ai enable row level security;

alter table public.ncr_comments enable row level security;

alter table public.ncr_patterns enable row level security;

alter table public.near_miss enable row level security;

alter table public.notification_prefs enable row level security;

alter table public.notifications_log enable row level security;

alter table public.oauth_tokens enable row level security;

alter table public.page_files enable row level security;

alter table public.password_reset_requests enable row level security;

alter table public.ppe enable row level security;

alter table public.projects enable row level security;

alter table public.ptw enable row level security;

alter table public.record_history enable row level security;

alter table public.rounds enable row level security;

alter table public.rsk enable row level security;

alter table public.saved_views enable row level security;

alter table public.server_state enable row level security;

alter table public.talk_topics enable row level security;

alter table public.tasks enable row level security;

alter table public.toolbox enable row level security;

alter table public.toolbox_reads enable row level security;

alter table public.toolbox_talks enable row level security;

alter table public.tour_hazards enable row level security;

alter table public.tr enable row level security;

alter table public.train_plan enable row level security;

alter table public.trustee_reports enable row level security;

alter table public.trustee_tasks enable row level security;

alter table public.trustee_winners enable row level security;

alter table public.trustees enable row level security;

alter table public.wst enable row level security;

create policy app_users_admin_write on public.app_users as PERMISSIVE for ALL to authenticated using (((( SELECT auth.jwt() AS jwt) ->> 'email'::text) = 'admin@tfugen.local'::text)) with check (((( SELECT auth.jwt() AS jwt) ->> 'email'::text) = 'admin@tfugen.local'::text));

create policy app_users_read on public.app_users as PERMISSIVE for SELECT to authenticated using ((( SELECT private.is_admin_manager() AS is_admin_manager) OR ((( SELECT auth.jwt() AS jwt) ->> 'email'::text) = (id || '@tfugen.local'::text))));

create policy mfa_required on public.app_users as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.app_users as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.app_users as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.app_users as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.app_users as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy audit_log_admin_manager_select on public.audit_log as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy audit_log_authenticated_insert on public.audit_log as PERMISSIVE for INSERT to authenticated with check (true);

create policy audit_log_no_anon_insert on public.audit_log as RESTRICTIVE for INSERT to authenticated with check ((COALESCE(((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean, false) = false));

create policy mfa_required on public.audit_log as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.audit_log as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.audit_log as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.audit_log as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.audit_log as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy auds_admin_manager_all on public.auds as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.auds as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.auds as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.auds as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.auds as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.auds as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.auds as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy ctr_admin_manager_all on public.ctr as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.ctr as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.ctr as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.ctr as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.ctr as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.ctr as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.ctr as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy custom_props_admin_manager_all on public.custom_props as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.custom_props as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.custom_props as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.custom_props as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.custom_props as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.custom_props as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.custom_props as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy docs_admin_manager_all on public.docs as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.docs as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.docs as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.docs as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.docs as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.docs as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.docs as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy drl_admin_manager_all on public.drl as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.drl as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.drl as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.drl as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.drl as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.drl as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.drl as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy emp_admin_manager_all on public.emp as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.emp as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.emp as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.emp as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.emp as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.emp as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.emp as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy env_admin_manager_all on public.env as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.env as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.env as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.env as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.env as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.env as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.env as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy env_aspects_admin_manager_all on public.env_aspects as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.env_aspects as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.env_aspects as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.env_aspects as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.env_aspects as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.env_aspects as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.env_aspects as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy equip_inspection_history_admin_manager_all on public.equip_inspection_history as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.equip_inspection_history as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.equip_inspection_history as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.equip_inspection_history as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.equip_inspection_history as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.equip_inspection_history as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.equip_inspection_history as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy emp_insert on public.equip_inspections as PERMISSIVE for INSERT to authenticated with check (true);

create policy equip_inspections_admin_manager_all on public.equip_inspections as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.equip_inspections as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.equip_inspections as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.equip_inspections as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.equip_inspections as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.equip_inspections as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.equip_inspections as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy files_admin_manager_all on public.files as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.files as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.files as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.files as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.files as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.files as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.files as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy hearing_tests_admin_manager_all on public.hearing_tests as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.hearing_tests as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.hearing_tests as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.hearing_tests as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.hearing_tests as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.hearing_tests as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.hearing_tests as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy hist_admin_manager_all on public.hist as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.hist as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.hist as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.hist as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.hist as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.hist as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.hist as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy hzm_admin_manager_all on public.hzm as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.hzm as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.hzm as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.hzm as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.hzm as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.hzm as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.hzm as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy inc_admin_manager_all on public.inc as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.inc as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.inc as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.inc as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.inc as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.inc as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.inc as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy ins_admin_manager_all on public.ins as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.ins as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.ins as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.ins as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.ins as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.ins as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.ins as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy inspection_types_admin_manager_all on public.inspection_types as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.inspection_types as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.inspection_types as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.inspection_types as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.inspection_types as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.inspection_types as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.inspection_types as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy issue_types_admin_manager_all on public.issue_types as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.issue_types as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.issue_types as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.issue_types as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.issue_types as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.issue_types as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.issue_types as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy leg_admin_manager_all on public.leg as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.leg as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.leg as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.leg as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.leg as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.leg as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.leg as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy locations_admin_manager_all on public.locations as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.locations as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.locations as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.locations as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.locations as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.locations as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.locations as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy med_admin_manager_all on public.med as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.med as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.med as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.med as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.med as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.med as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.med as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.mgmt_reviews as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy mgmt_reviews_admin_manager_all on public.mgmt_reviews as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy pwchange_required on public.mgmt_reviews as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.mgmt_reviews as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.mgmt_reviews as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.mgmt_reviews as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.mgmt_reviews as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.ncr as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy ncr_admin_all on public.ncr as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_only() AS is_admin_only)) with check (( SELECT private.is_admin_only() AS is_admin_only));

create policy ncr_manager_non_sens on public.ncr as PERMISSIVE for ALL to authenticated using ((( SELECT private.is_admin_manager() AS is_admin_manager) AND (sens IS NOT TRUE))) with check ((( SELECT private.is_admin_manager() AS is_admin_manager) AND (sens IS NOT TRUE)));

create policy pwchange_required on public.ncr as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.ncr as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.ncr as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.ncr as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.ncr as PERMISSIVE for SELECT to authenticated using ((( SELECT private.is_viewer() AS is_viewer) AND (sens IS NOT TRUE)));

create policy mfa_required on public.ncr_ai as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy ncr_ai_admin_manager_all on public.ncr_ai as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy pwchange_required on public.ncr_ai as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.ncr_ai as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.ncr_ai as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.ncr_ai as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.ncr_ai as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.ncr_comments as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy ncr_comments_admin_manager_all on public.ncr_comments as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy pwchange_required on public.ncr_comments as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.ncr_comments as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.ncr_comments as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.ncr_comments as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.ncr_comments as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.ncr_patterns as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy ncr_patterns_admin_manager_all on public.ncr_patterns as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy pwchange_required on public.ncr_patterns as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.ncr_patterns as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.ncr_patterns as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.ncr_patterns as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.ncr_patterns as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy emp_insert on public.near_miss as PERMISSIVE for INSERT to authenticated with check (true);

create policy mfa_required on public.near_miss as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy near_miss_admin_manager_all on public.near_miss as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy pwchange_required on public.near_miss as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.near_miss as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.near_miss as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.near_miss as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.near_miss as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.notification_prefs as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy notification_prefs_own on public.notification_prefs as PERMISSIVE for ALL to authenticated using ((id = (( SELECT auth.jwt() AS jwt) ->> 'email'::text))) with check ((id = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)));

create policy pwchange_required on public.notification_prefs as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.notification_prefs as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.notification_prefs as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.notification_prefs as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy mfa_required on public.notifications_log as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy notifications_log_admin_manager_all on public.notifications_log as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy pwchange_required on public.notifications_log as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.notifications_log as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.notifications_log as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.notifications_log as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.notifications_log as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.oauth_tokens as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.oauth_tokens as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.oauth_tokens as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.oauth_tokens as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.oauth_tokens as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy mfa_required on public.page_files as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy page_files_admin_manager_all on public.page_files as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy pwchange_required on public.page_files as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.page_files as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.page_files as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.page_files as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.page_files as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy auth_can_read_reset_request on public.password_reset_requests as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy auth_can_update_reset_request on public.password_reset_requests as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy mfa_required on public.password_reset_requests as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.password_reset_requests as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.password_reset_requests as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.password_reset_requests as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.password_reset_requests as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy mfa_required on public.ppe as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy ppe_admin_manager_all on public.ppe as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy pwchange_required on public.ppe as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.ppe as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.ppe as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.ppe as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.ppe as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.projects as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy projects_admin_manager_all on public.projects as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy pwchange_required on public.projects as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.projects as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.projects as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.projects as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.projects as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.ptw as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy ptw_admin_manager_all on public.ptw as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy pwchange_required on public.ptw as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.ptw as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.ptw as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.ptw as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.ptw as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.record_history as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.record_history as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy record_history_insert on public.record_history as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy record_history_read on public.record_history as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy viewer_no_delete on public.record_history as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.record_history as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.record_history as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.record_history as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy emp_insert on public.rounds as PERMISSIVE for INSERT to authenticated with check (true);

create policy mfa_required on public.rounds as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.rounds as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy rounds_admin_manager_all on public.rounds as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy viewer_no_delete on public.rounds as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.rounds as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.rounds as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.rounds as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.rsk as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.rsk as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy rsk_admin_manager_all on public.rsk as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy viewer_no_delete on public.rsk as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.rsk as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.rsk as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.rsk as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.saved_views as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.saved_views as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy saved_views_own on public.saved_views as PERMISSIVE for ALL to authenticated using ((user_email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text))) with check ((user_email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)));

create policy viewer_no_delete on public.saved_views as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.saved_views as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.saved_views as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy mfa_required on public.tasks as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.tasks as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy tasks_admin_manager_all on public.tasks as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy viewer_no_delete on public.tasks as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.tasks as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.tasks as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.tasks as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.toolbox as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.toolbox as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy toolbox_admin_manager_all on public.toolbox as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy viewer_no_delete on public.toolbox as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.toolbox as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.toolbox as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.toolbox as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.toolbox_reads as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.toolbox_reads as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy toolbox_reads_admin_manager_all on public.toolbox_reads as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy viewer_no_delete on public.toolbox_reads as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.toolbox_reads as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.toolbox_reads as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.toolbox_reads as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.toolbox_talks as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.toolbox_talks as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy toolbox_talks_admin_manager_all on public.toolbox_talks as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy viewer_no_delete on public.toolbox_talks as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.toolbox_talks as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.toolbox_talks as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.toolbox_talks as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.tour_hazards as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.tour_hazards as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy tour_hazards_admin_manager_all on public.tour_hazards as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy viewer_no_delete on public.tour_hazards as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.tour_hazards as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.tour_hazards as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.tour_hazards as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy emp_insert on public.tr as PERMISSIVE for INSERT to authenticated with check (true);

create policy mfa_required on public.tr as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.tr as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy tr_admin_manager_all on public.tr as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy viewer_no_delete on public.tr as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.tr as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.tr as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.tr as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy mfa_required on public.train_plan as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.train_plan as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy train_plan_admin_manager_all on public.train_plan as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy viewer_no_delete on public.train_plan as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.train_plan as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.train_plan as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.train_plan as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy emp_insert on public.trustee_reports as PERMISSIVE for INSERT to authenticated with check (true);

create policy emp_select on public.trustee_reports as PERMISSIVE for SELECT to authenticated using (true);

create policy kiosk_window on public.trustee_reports as RESTRICTIVE for SELECT to authenticated using (((COALESCE(((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean, false) = false) OR (d >= (CURRENT_DATE - 90)) OR ((ok = false) AND (s IS DISTINCT FROM 'נסגר'::text))));

create policy mfa_required on public.trustee_reports as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.trustee_reports as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy trustee_reports_admin_manager_delete on public.trustee_reports as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy trustee_reports_admin_manager_update on public.trustee_reports as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy viewer_no_delete on public.trustee_reports as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.trustee_reports as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.trustee_reports as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy mfa_required on public.trustee_tasks as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.trustee_tasks as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy trustee_tasks_admin_manager_delete on public.trustee_tasks as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy trustee_tasks_admin_manager_insert on public.trustee_tasks as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy trustee_tasks_admin_manager_update on public.trustee_tasks as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy trustee_tasks_read on public.trustee_tasks as PERMISSIVE for SELECT to authenticated using (true);

create policy viewer_no_delete on public.trustee_tasks as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.trustee_tasks as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.trustee_tasks as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy mfa_required on public.trustee_winners as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.trustee_winners as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy trustee_winners_admin_manager_delete on public.trustee_winners as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy trustee_winners_admin_manager_insert on public.trustee_winners as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy trustee_winners_admin_manager_update on public.trustee_winners as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy trustee_winners_read on public.trustee_winners as PERMISSIVE for SELECT to authenticated using (true);

create policy viewer_no_delete on public.trustee_winners as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.trustee_winners as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.trustee_winners as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy mfa_required on public.trustees as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.trustees as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy trustees_admin_manager_delete on public.trustees as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy trustees_admin_manager_insert on public.trustees as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy trustees_admin_manager_update on public.trustees as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy trustees_read on public.trustees as PERMISSIVE for SELECT to authenticated using (true);

create policy viewer_no_delete on public.trustees as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.trustees as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.trustees as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy mfa_required on public.wst as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on public.wst as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy viewer_no_delete on public.wst as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on public.wst as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on public.wst as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_read on public.wst as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_viewer() AS is_viewer));

create policy wst_admin_manager_all on public.wst as PERMISSIVE for ALL to authenticated using (( SELECT private.is_admin_manager() AS is_admin_manager)) with check (( SELECT private.is_admin_manager() AS is_admin_manager));

create policy incidents_photos_delete_named_user on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'incidents-photos'::text) AND (COALESCE(((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean, true) = false) AND (COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text) <> ''::text) AND ( SELECT private.is_admin_manager() AS is_admin_manager)));

create policy incidents_photos_insert_named_user on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'incidents-photos'::text) AND (COALESCE(((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean, true) = false) AND (COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text) <> ''::text)));

create policy incidents_photos_insert_trustee_kiosk on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'incidents-photos'::text) AND (name ~~ 'tru-ph-%'::text)));

create policy incidents_photos_select_named_user on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'incidents-photos'::text) AND (COALESCE(((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean, true) = false) AND (COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text) <> ''::text)));

create policy incidents_photos_select_trustee_kiosk on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'incidents-photos'::text) AND (name ~~ 'tru-ph-%'::text)));

create policy incidents_photos_update_named_user on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'incidents-photos'::text) AND (COALESCE(((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean, true) = false) AND (COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text) <> ''::text) AND ( SELECT private.is_admin_manager() AS is_admin_manager))) with check (((bucket_id = 'incidents-photos'::text) AND (COALESCE(((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean, true) = false) AND (COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text) <> ''::text) AND ( SELECT private.is_admin_manager() AS is_admin_manager)));

create policy mfa_required on storage.objects as RESTRICTIVE for ALL to authenticated using (( SELECT private.mfa_ok() AS mfa_ok)) with check (( SELECT private.mfa_ok() AS mfa_ok));

create policy pwchange_required on storage.objects as RESTRICTIVE for ALL to authenticated using ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false)) with check ((COALESCE((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'must_change_password'::text))::boolean, false) = false));

create policy tapugan_auth_read_backups on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'backups'::text) AND (COALESCE(((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean, true) = false) AND (COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text) <> ''::text) AND ( SELECT private.is_admin_manager() AS is_admin_manager)));

create policy viewer_no_delete on storage.objects as RESTRICTIVE for DELETE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_insert on storage.objects as RESTRICTIVE for INSERT to authenticated with check ((NOT ( SELECT private.is_viewer() AS is_viewer)));

create policy viewer_no_update on storage.objects as RESTRICTIVE for UPDATE to authenticated using ((NOT ( SELECT private.is_viewer() AS is_viewer)));

revoke all on table private.anon_writes from anon, authenticated;

revoke all on table public.app_users from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.app_users to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.app_users to authenticated;

revoke all on table public.audit_log from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_log to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_log to authenticated;

revoke all on table public.auds from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.auds to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.auds to authenticated;

revoke all on table public.ctr from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ctr to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ctr to authenticated;

revoke all on table public.custom_props from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.custom_props to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.custom_props to authenticated;

revoke all on table public.docs from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.docs to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.docs to authenticated;

revoke all on table public.drl from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.drl to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.drl to authenticated;

revoke all on table public.emp from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.emp to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.emp to authenticated;

revoke all on table public.env from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.env to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.env to authenticated;

revoke all on table public.env_aspects from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.env_aspects to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.env_aspects to authenticated;

revoke all on table public.equip_inspection_history from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.equip_inspection_history to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.equip_inspection_history to authenticated;

revoke all on table public.equip_inspections from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.equip_inspections to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.equip_inspections to authenticated;

revoke all on table public.files from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.files to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.files to authenticated;

revoke all on table public.hearing_tests from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.hearing_tests to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.hearing_tests to authenticated;

revoke all on table public.hist from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.hist to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.hist to authenticated;

revoke all on table public.hzm from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.hzm to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.hzm to authenticated;

revoke all on table public.inc from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.inc to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.inc to authenticated;

revoke all on table public.ins from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ins to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ins to authenticated;

revoke all on table public.inspection_types from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.inspection_types to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.inspection_types to authenticated;

revoke all on table public.issue_types from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.issue_types to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.issue_types to authenticated;

revoke all on table public.item_links from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.item_links to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.item_links to authenticated;

revoke all on table public.leg from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.leg to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.leg to authenticated;

revoke all on table public.locations from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.locations to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.locations to authenticated;

revoke all on table public.med from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.med to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.med to authenticated;

revoke all on table public.mgmt_reviews from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.mgmt_reviews to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.mgmt_reviews to authenticated;

revoke all on table public.ncr from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ncr to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ncr to authenticated;

revoke all on table public.ncr_ai from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ncr_ai to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ncr_ai to authenticated;

revoke all on table public.ncr_comments from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ncr_comments to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ncr_comments to authenticated;

revoke all on table public.ncr_patterns from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ncr_patterns to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ncr_patterns to authenticated;

revoke all on table public.near_miss from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.near_miss to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.near_miss to authenticated;

revoke all on table public.notification_prefs from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notification_prefs to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notification_prefs to authenticated;

revoke all on table public.notifications_log from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notifications_log to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notifications_log to authenticated;

revoke all on table public.oauth_tokens from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.oauth_tokens to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.oauth_tokens to authenticated;

revoke all on table public.page_files from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.page_files to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.page_files to authenticated;

revoke all on table public.password_reset_requests from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.password_reset_requests to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.password_reset_requests to authenticated;

revoke all on table public.ppe from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ppe to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ppe to authenticated;

revoke all on table public.projects from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.projects to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.projects to authenticated;

revoke all on table public.ptw from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ptw to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ptw to authenticated;

revoke all on table public.record_history from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.record_history to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.record_history to authenticated;

revoke all on table public.rounds from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rounds to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rounds to authenticated;

revoke all on table public.rsk from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rsk to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rsk to authenticated;

revoke all on table public.saved_views from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.saved_views to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.saved_views to authenticated;

revoke all on table public.server_state from anon, authenticated;

revoke all on table public.talk_topics from anon, authenticated;

revoke all on table public.tasks from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tasks to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tasks to authenticated;

revoke all on table public.toolbox from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.toolbox to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.toolbox to authenticated;

revoke all on table public.toolbox_reads from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.toolbox_reads to authenticated;

revoke all on table public.toolbox_talks from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.toolbox_talks to authenticated;

revoke all on table public.tour_hazards from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tour_hazards to authenticated;

revoke all on table public.tr from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tr to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tr to authenticated;

revoke all on table public.train_plan from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.train_plan to authenticated;

revoke all on table public.trustee_reports from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trustee_reports to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trustee_reports to authenticated;

revoke all on table public.trustee_tasks from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trustee_tasks to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trustee_tasks to authenticated;

revoke all on table public.trustee_winners from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trustee_winners to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trustee_winners to authenticated;

revoke all on table public.trustees from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trustees to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trustees to authenticated;

revoke all on table public.wst from anon, authenticated;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.wst to anon;

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.wst to authenticated;

revoke all on function private.anon_users_cleanup() from public, anon, authenticated;

revoke all on function private.anon_write_cap() from public, anon, authenticated;

revoke all on function private.audit_log_stamp() from public, anon, authenticated;

revoke all on function private.audit_row() from public, anon, authenticated;

revoke all on function private.audit_tables() from public, anon, authenticated;

revoke all on function private.backup_od_tick() from public, anon, authenticated;

revoke all on function private.clear_must_change_password() from public, anon, authenticated;

grant execute on function private.clear_must_change_password() to supabase_auth_admin;

revoke all on function private.db_columns_check() from public, anon, authenticated;

revoke all on function private.hazard_file_ping() from public, anon, authenticated;

revoke all on function private.hazard_file_trg() from public, anon, authenticated;

revoke all on function private.is_admin_manager() from public, anon, authenticated;

grant execute on function private.is_admin_manager() to public;

grant execute on function private.is_admin_manager() to anon;

grant execute on function private.is_admin_manager() to authenticated;

revoke all on function private.is_viewer() from public, anon, authenticated;

grant execute on function private.is_viewer() to public;

grant execute on function private.is_viewer() to authenticated;

revoke all on function private.mail_inbox_tick() from public, anon, authenticated;

revoke all on function private.mfa_ok() from public, anon, authenticated;

grant execute on function private.mfa_ok() to public;

grant execute on function private.mfa_ok() to authenticated;

revoke all on function private.near_miss_notify() from public, anon, authenticated;

revoke all on function private.od_scan_tick() from public, anon, authenticated;

revoke all on function private.protect_delete() from public, anon, authenticated;

revoke all on function private.ptw_ver() from public, anon, authenticated;

revoke all on function private.talk_week(p_day date) from public, anon, authenticated;

revoke all on function private.trustee_log_tick() from public, anon, authenticated;

revoke all on function private.trustee_reports_before_ins() from public, anon, authenticated;

revoke all on function private.trustee_reports_close_ref() from public, anon, authenticated;

revoke all on function private.trustee_reports_notify() from public, anon, authenticated;

revoke all on function private.trustee_reports_num() from public, anon, authenticated;

revoke all on function private.vitre_sync_tick() from public, anon, authenticated;

revoke all on function private.wa_morning_tick() from public, anon, authenticated;

revoke all on function private.wa_watch_tick() from public, anon, authenticated;

revoke all on function private.weather_tick() from public, anon, authenticated;

revoke all on function private.weekly_digest_tick() from public, anon, authenticated;

revoke all on function private.xlsx_gaps_tick() from public, anon, authenticated;

revoke all on function public.cancel_orphan_tasks_on_equip_delete() from public, anon, authenticated;

grant execute on function public.cancel_orphan_tasks_on_equip_delete() to public;

grant execute on function public.cancel_orphan_tasks_on_equip_delete() to anon;

grant execute on function public.cancel_orphan_tasks_on_equip_delete() to authenticated;

revoke all on function public.equip_inspections_alias_sync() from public, anon, authenticated;

grant execute on function public.equip_inspections_alias_sync() to public;

grant execute on function public.equip_inspections_alias_sync() to anon;

grant execute on function public.equip_inspections_alias_sync() to authenticated;

revoke all on function public.guess_clear(p_key text) from public, anon, authenticated;

revoke all on function public.guess_hit(p_key text, p_window_s integer) from public, anon, authenticated;

revoke all on function public.net_recent_errors(minutes integer) from public, anon, authenticated;

grant usage on schema private to anon, authenticated, supabase_auth_admin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('backups', 'backups', false, null, NULL) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('incidents-photos', 'incidents-photos', false, 52428800, '{image/*,video/*,audio/*,application/*,text/plain,text/csv,message/rfc822}') on conflict (id) do nothing;

alter publication supabase_realtime add table public.audit_log, public.auds, public.ctr, public.docs, public.drl, public.emp, public.env, public.equip_inspections, public.hzm, public.inc, public.ins, public.leg, public.med, public.ncr, public.near_miss, public.ppe, public.ptw, public.rounds, public.rsk, public.toolbox, public.tr, public.trustee_reports, public.trustee_tasks, public.trustee_winners, public.trustees, public.wst;

select cron.schedule('anon-users-cleanup', '13 2 * * 0', 'select private.anon_users_cleanup()');

select cron.schedule('backup-od', '30 3,4 * * *', 'select private.backup_od_tick()');

select cron.schedule('db-columns-check', '41 2 1 * *', 'select private.db_columns_check()');

select cron.schedule('hazard-file-retry', '*/15 * * * *', 'select private.hazard_file_ping()');

select cron.schedule('od-scan', '50 2 * * *', 'select private.od_scan_tick()');

select cron.schedule('talk-week', '17 2 * * 0', 'select private.talk_week()');

select cron.schedule('trustee-log-retry', '*/15 * * * *', 'select private.trustee_log_tick()');

select cron.schedule('vitre-sync', '0 3,4 * * *', 'select private.vitre_sync_tick()');

select cron.schedule('wa-morning', '47 4,5 * * 0-4', 'select private.wa_morning_tick()');

select cron.schedule('wa-watch', '*/5 * * * *', 'select private.wa_watch_tick()');

select cron.schedule('weather', '7 14 * * *', 'select private.weather_tick()');

select cron.schedule('weekly-digest', '0 4,5 * * 0', 'select private.weekly_digest_tick()');

select cron.schedule('xlsx-gaps', '5 3 * * *', 'select private.xlsx_gaps_tick()');
