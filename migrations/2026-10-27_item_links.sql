-- 27/10/2026: a light knowledge graph (Michael in the questionnaire: "do it: a light knowledge graph, interview first";
-- in the interview: the agents fill it on their own, from now on). One row = one link between an item of the
-- database (equipment or document) and something outside it that belongs to it: a mail thread, a quote, an
-- inspection report, an order, a supplier. The item card (routine-db item_card) shows them, so the sources of one
-- item are found by link and not by guessing words (the fork extenders, 27/10/2026: four sources, none linked).
-- Only the server writes (routine-db link_add, service role); no policy for anon or authenticated.
create table if not exists public.item_links (
  id bigint generated always as identity primary key,
  item_table text not null check (item_table in ('equip_inspections', 'docs')),
  item_id text not null,
  rel text not null check (rel in ('mail', 'quote', 'report', 'order', 'supplier', 'file')),
  ref text not null check (length(ref) between 3 and 600),
  title text not null check (length(title) between 2 and 200),
  at timestamptz not null default now(),
  agent text not null,
  unique (item_table, item_id, rel, ref)
);
create index if not exists item_links_item on public.item_links (item_table, item_id);
alter table public.item_links enable row level security;
