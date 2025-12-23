# Supabase Setup (Manual)

These steps must be done in the Supabase dashboard:

1) Create a new Supabase project.
2) Open SQL Editor and run `supabase/schema.sql`.
3) Enable Row Level Security (RLS) on all tables.
4) Run `supabase/rls.sql` to add policies.
5) Set JWT claims to include `wallet` (used by policies).
6) Copy the project URL and anon key into `apps/web/.env`.

Notes:
- Use the service role key only in KRNL workflows or secure server contexts.
- Do not commit Supabase keys to git.
