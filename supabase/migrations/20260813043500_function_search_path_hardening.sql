-- Pin function search path so public functions do not depend on caller context.

alter function public.is_valid_feature_key(text)
set search_path = public, pg_temp;
