-- ============================================================
-- Karigar (Worker) Portal RPC
-- 2026-08-12: Initial implementation
-- 
-- get_karigar_portal() — reads worker's own data using their
-- Supabase auth.uid(). Works when a karigar logs in via OTP.
--
-- The karigar's phone number (from auth.users) is matched
-- against the `people` table row where type = 'karigar'
-- and phone matches. Falls back to email match.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_karigar_portal()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_user_phone text;
  v_worker_id text;
  v_worker_name text;
  v_firm_id text;
  v_gold_balance jsonb;
  v_gold_entries jsonb;
  v_wages jsonb;
  v_attendance jsonb;
  v_result jsonb;
BEGIN
  -- Get calling user's identity
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    COALESCE(u.email, ''),
    COALESCE(u.phone, '')
  INTO v_user_email, v_user_phone
  FROM auth.users u
  WHERE u.id = v_user_id;

  -- ── Find matching worker/karigar record in people table ─────────────────
  -- The `data` column stores a JSON blob with type, fullName, phone, etc.
  SELECT
    p.id,
    p.data->>'fullName',
    p.data->>'firmId'
  INTO v_worker_id, v_worker_name, v_firm_id
  FROM people p
  WHERE
    (p.data->>'type' = 'karigar' OR p.data->>'type' = 'worker')
    AND (
      p.data->>'phone' = v_user_phone
      OR lower(p.data->>'email') = lower(v_user_email)
    )
  LIMIT 1;

  -- If no karigar record found, return a minimal response
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'message', 'No karigar profile linked to this account. Contact your firm administrator.'
    );
  END IF;

  -- ── Gold Ledger entries for this karigar (last 90 days) ────────────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', gl.id,
      'ts', gl.ts,
      'type', gl.data->>'type',
      'narration', gl.data->>'narration',
      'netFineMg', gl.data->'netFineMg',
      'grossMg', gl.data->'grossMg',
      'purity', gl.data->'purity',
      'slipNo', gl.data->>'slipNo'
    ) ORDER BY gl.ts DESC
  ), '[]'::jsonb)
  INTO v_gold_entries
  FROM gold_ledger gl
  WHERE
    gl.data->>'karigarId' = v_worker_id
    AND gl.ts > NOW() - INTERVAL '90 days';

  -- ── Current gold balance (sum of all entries) ─────────────────────────
  SELECT jsonb_build_object(
    'issuedMg', COALESCE(SUM(CASE WHEN (gl.data->>'netFineMg')::numeric < 0 THEN ABS((gl.data->>'netFineMg')::numeric) ELSE 0 END), 0),
    'receivedMg', COALESCE(SUM(CASE WHEN (gl.data->>'netFineMg')::numeric > 0 THEN (gl.data->>'netFineMg')::numeric ELSE 0 END), 0),
    'balanceMg', COALESCE(-SUM((gl.data->>'netFineMg')::numeric), 0)
  )
  INTO v_gold_balance
  FROM gold_ledger gl
  WHERE gl.data->>'karigarId' = v_worker_id;

  -- ── Recent attendance (last 30 days) ──────────────────────────────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', a.data->>'date',
      'status', a.data->>'status',
      'inTime', a.data->>'inTime',
      'outTime', a.data->>'outTime'
    ) ORDER BY a.data->>'date' DESC
  ), '[]'::jsonb)
  INTO v_attendance
  FROM attendance a
  WHERE
    a.data->>'workerId' = v_worker_id
    AND (a.data->>'date')::date > CURRENT_DATE - INTERVAL '30 days';

  -- ── Worker transactions (wages, withdrawals) ───────────────────────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', wt.id,
      'kind', wt.kind,
      'ts', wt.ts,
      'amount', wt.data->'amount',
      'notes', wt.data->>'notes'
    ) ORDER BY wt.ts DESC
  ), '[]'::jsonb)
  INTO v_wages
  FROM worker_transactions wt
  WHERE
    wt.data->>'workerId' = v_worker_id
    AND wt.ts > NOW() - INTERVAL '90 days';

  -- ── Compose final result ───────────────────────────────────────────────
  v_result := jsonb_build_object(
    'found', true,
    'profile', jsonb_build_object(
      'id', v_worker_id,
      'name', v_worker_name,
      'firmId', v_firm_id
    ),
    'goldBalance', v_gold_balance,
    'goldEntries', v_gold_entries,
    'wages', v_wages,
    'attendance', v_attendance
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users (each karigar reads only their own data)
GRANT EXECUTE ON FUNCTION public.get_karigar_portal() TO authenticated;

COMMENT ON FUNCTION public.get_karigar_portal() IS
  'Karigar self-service portal RPC: returns the calling karigar''s gold balance, '
  'ledger entries, wages, and attendance. Matched by phone or email from auth.users.';
