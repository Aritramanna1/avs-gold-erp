-- Single configurable foundation for multi-metal vault and conversion.
create table if not exists public.precious_metals (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (firm_id, code)
);

create table if not exists public.precious_metal_purities (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.organizations(id) on delete cascade,
  metal_id uuid not null references public.precious_metals(id) on delete cascade,
  label text not null,
  permille integer not null check (permille between 1 and 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (firm_id, metal_id, permille)
);

create table if not exists public.metal_composition_formulas (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.organizations(id) on delete cascade,
  metal_id uuid not null references public.precious_metals(id) on delete restrict,
  target_purity_id uuid not null references public.precious_metal_purities(id) on delete restrict,
  version integer not null check (version > 0),
  effective_from date not null,
  fine_metal_permille integer not null check (fine_metal_permille between 1 and 1000),
  components jsonb not null default '[]'::jsonb,
  expected_loss_pct numeric(8,4) not null default 0 check (expected_loss_pct >= 0 and expected_loss_pct <= 100),
  active boolean not null default true,
  remarks text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (firm_id, metal_id, target_purity_id, version)
);

alter table public.precious_metals enable row level security;
alter table public.precious_metal_purities enable row level security;
alter table public.metal_composition_formulas enable row level security;

do $$ begin
  create policy "Firm members manage precious metals" on public.precious_metals for all
    using (firm_id = public.my_firm_id()) with check (firm_id = public.my_firm_id());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Firm members manage metal purities" on public.precious_metal_purities for all
    using (firm_id = public.my_firm_id()) with check (firm_id = public.my_firm_id());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Firm members manage composition formulas" on public.metal_composition_formulas for all
    using (firm_id = public.my_firm_id()) with check (firm_id = public.my_firm_id());
exception when duplicate_object then null; end $$;

create index if not exists idx_precious_metals_firm on public.precious_metals(firm_id);
create index if not exists idx_metal_purities_firm_metal on public.precious_metal_purities(firm_id, metal_id);
create index if not exists idx_composition_formulas_lookup on public.metal_composition_formulas(firm_id, metal_id, target_purity_id, effective_from desc);
