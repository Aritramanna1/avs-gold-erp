begin;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.is_saas_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_role(auth.uid(), 'saas_admin'::public.app_role) $$;

create or replace function public.my_firm_id()
returns uuid language sql stable security definer set search_path = public
as $$ select firm_id from public.user_profiles where auth_id = auth.uid() and active and status = 'active' limit 1 $$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public
as $$ select role::text from public.user_roles where user_id = auth.uid() order by case when role = 'owner' then 0 when role = 'admin' then 1 else 2 end limit 1 $$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_role(_user_id, 'owner'::public.app_role) or public.has_role(_user_id, 'admin'::public.app_role) or public.has_role(_user_id, 'saas_admin'::public.app_role) $$;

revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.is_saas_admin() from public;
revoke all on function public.my_firm_id() from public;
revoke all on function public.my_role() from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_saas_admin() to authenticated, service_role;
grant execute on function public.my_firm_id() to authenticated, service_role;
grant execute on function public.my_role() to authenticated, service_role;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

commit;
