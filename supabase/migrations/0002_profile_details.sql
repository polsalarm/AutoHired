-- AutoHired — extend profiles with personal info used for AI analysis (Phase 8)
-- Run via Supabase SQL editor or `supabase db push`.

alter table public.profiles
  add column if not exists summary text,
  add column if not exists skills text,
  add column if not exists experience text,
  add column if not exists education text,
  add column if not exists location text,
  add column if not exists links text;

-- summary    : short professional bio / objective
-- skills      : comma-separated or freeform list of skills
-- experience  : roles, internships, projects (freeform)
-- education   : school, degree, year (freeform)
-- location    : city / country
-- links       : portfolio / GitHub / LinkedIn URLs (freeform)
