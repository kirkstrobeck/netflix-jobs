-- What the last crawl rendered, per role, as two digests.
--
-- The web app caches a finished render per posting and a finished render per
-- facet combination, and only a tag can replace one. Nothing in Postgres can
-- fire a tag, so the ingestor does it -- and to fire it HONESTLY it has to know
-- what actually moved between crawls. Eightfold gives no per-posting version and
-- its `t_update` moves on rows whose visible content is byte-identical, so the
-- answer is computed rather than read: digest the fields the app renders, store
-- it, compare it next time.
--
-- A SEPARATE TABLE, NOT TWO MORE COLUMNS ON public.jobs.
--
-- These are facts about the CACHE, not about the posting. Keeping them out of
-- `jobs` means ingest_jobs() -- the 80-line upsert every crawl runs -- does not
-- change at all, the payload it takes does not grow, and a checksum can never be
-- selected into the board by accident. It also means the digests are written
-- AFTER the rows land, so a crawl that dies mid-write leaves no checksum
-- claiming content that was never stored.
--
-- TWO DIGESTS, BECAUSE THERE ARE TWO CACHES WITH DIFFERENT BLAST RADII.
--
-- board_checksum covers only what the listing draws or filters on. content_
-- checksum covers everything a posting's own page renders, which is a superset.
-- A rewritten description moves the second and not the first, so the posting is
-- flushed and the 300-odd cached listing URLs are left alone. See
-- packages/ingestor/lib/checksum.ts for exactly which columns feed each.
create table public.job_checksums (
  -- Same key as the posting, and cascading: a role deleted outright takes its
  -- checksum with it rather than leaving one that would make the role look
  -- unchanged if it ever came back.
  position_id bigint primary key references public.jobs (position_id) on delete cascade,
  -- Carried so the ingestor can name a tag -- `job:JR41912` -- without joining
  -- back to `jobs` for a column it already had in hand when it wrote this row.
  display_job_id text,
  board_checksum text not null,
  content_checksum text not null,
  updated_at timestamptz not null default now()
);

alter table public.job_checksums enable row level security;

create policy "service role can manage job_checksums"
  on public.job_checksums for all to service_role using (true) with check (true);

-- No public read policy and no select grant. Every other table here mirrors a
-- public job board; this one is cache bookkeeping, of no use to a visitor and
-- not part of what the board publishes.
grant all privileges on table public.job_checksums to service_role;
