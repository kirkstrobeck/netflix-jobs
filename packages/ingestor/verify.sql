-- Evidence queries for a completed crawl.
--
--   docker exec -i supabase_db_netflix-jobs \
--     psql -U postgres -d postgres -f - < packages/ingestor/verify.sql
--
-- or, from a host with psql:
--   psql postgresql://postgres:postgres@127.0.0.1:54722/postgres -f packages/ingestor/verify.sql

\echo '== row counts =='
select
  (select count(*) from public.jobs) as jobs,
  (select count(*) from public.jobs where is_active) as active_jobs,
  (select count(*) from public.job_locations) as job_locations,
  (select count(*) from public.jobs where description_text <> '') as with_description,
  (select count(distinct location) from public.job_locations) as distinct_locations;

\echo ''
\echo '== latest ingest run =='
select status, listed_count, detail_ok_count, detail_failed_count, upserted_count,
       deactivated_count, round(extract(epoch from finished_at - started_at)) as seconds, notes
  from public.ingest_runs
 order by started_at desc
 limit 1;

\echo ''
\echo '== sample rows =='
select position_id, display_job_id, left(title, 40) as title, department,
       left(location, 30) as location, work_type, posting_date,
       length(description_text) as desc_chars
  from public.jobs
 order by posting_date desc nulls last, position_id
 limit 5;

\echo ''
\echo '== top departments =='
select department, count(*) as openings
  from public.jobs
 where is_active
 group by department
 order by openings desc
 limit 10;

\echo ''
\echo '== top locations =='
select location, count(*) as openings
  from public.job_locations
 group by location
 order by openings desc
 limit 10;
