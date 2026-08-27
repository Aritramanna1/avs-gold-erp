-- Public document verification / share rate limiting (backend-authoritative).
-- Complements client-side consumePublicRateLimit; does not throttle normal ERP RPCs.

CREATE TABLE IF NOT EXISTS public.public_rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  hit_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.public_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- No direct client DML — only SECURITY DEFINER RPC below.
REVOKE ALL ON public.public_rate_limit_buckets FROM PUBLIC;
REVOKE ALL ON public.public_rate_limit_buckets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.public_rate_limit_buckets TO service_role;

CREATE OR REPLACE FUNCTION public.consume_public_rate_limit(
  p_bucket text,
  p_limit integer DEFAULT 40,
  p_window_seconds integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := left(coalesce(nullif(trim(p_bucket), ''), 'public:default'), 200);
  v_limit integer := greatest(1, least(coalesce(p_limit, 40), 500));
  v_window integer := greatest(5, least(coalesce(p_window_seconds, 60), 3600));
  v_row public.public_rate_limit_buckets%ROWTYPE;
  v_now timestamptz := now();
  v_retry_ms integer := 0;
BEGIN
  SELECT * INTO v_row FROM public.public_rate_limit_buckets WHERE bucket_key = v_key FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.public_rate_limit_buckets (bucket_key, hit_count, window_started_at, updated_at)
    VALUES (v_key, 1, v_now, v_now);
    RETURN jsonb_build_object('allowed', true, 'retry_after_ms', 0, 'remaining', v_limit - 1);
  END IF;

  IF v_now >= v_row.window_started_at + make_interval(secs => v_window) THEN
    UPDATE public.public_rate_limit_buckets
    SET hit_count = 1, window_started_at = v_now, updated_at = v_now
    WHERE bucket_key = v_key;
    RETURN jsonb_build_object('allowed', true, 'retry_after_ms', 0, 'remaining', v_limit - 1);
  END IF;

  IF v_row.hit_count >= v_limit THEN
    v_retry_ms := greatest(
      0,
      (extract(epoch from (v_row.window_started_at + make_interval(secs => v_window) - v_now)) * 1000)::integer
    );
    RETURN jsonb_build_object('allowed', false, 'retry_after_ms', v_retry_ms, 'remaining', 0);
  END IF;

  UPDATE public.public_rate_limit_buckets
  SET hit_count = hit_count + 1, updated_at = v_now
  WHERE bucket_key = v_key;

  RETURN jsonb_build_object(
    'allowed', true,
    'retry_after_ms', 0,
    'remaining', greatest(0, v_limit - (v_row.hit_count + 1))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_public_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_public_rate_limit(text, integer, integer) TO anon, authenticated;

COMMENT ON FUNCTION public.consume_public_rate_limit IS
  'Throttle public verify/share lookups. Normal authenticated ERP RPCs do not use this.';
