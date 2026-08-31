-- Create login_attempts table to track login failures and success for rate limiting
create table public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text,
  ip text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

-- Enable RLS so that no anon or authenticated users can access the data.
-- Only the service_role key (used by the Edge Function) can access/write to this table.
alter table public.login_attempts enable row level security;

-- Indexes for fast queries in our rate limiting checking window (last 60 min)
create index login_attempts_email_created_at_idx on public.login_attempts (email, created_at);
create index login_attempts_ip_created_at_idx on public.login_attempts (ip, created_at);
