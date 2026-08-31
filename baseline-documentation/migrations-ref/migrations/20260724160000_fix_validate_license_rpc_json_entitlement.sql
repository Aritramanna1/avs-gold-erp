-- validate_license returned v_license.payload as a raw text value, which
-- json_build_object embeds as a quoted JSON string, not an object. The
-- Supabase-mode client (src/lib/licensing/license-store.ts) casts
-- response.entitlement directly to SignedEntitlementPayload with no parsing
-- step (that trust boundary is TLS + RLS on this RPC, not a client-side
-- signature check) -- so it needs a real JSON object, not a string.
CREATE OR REPLACE FUNCTION public.validate_license(
    p_license_key text,
    p_device_id text,
    p_deployment_mode text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_license record;
BEGIN
    SELECT * INTO v_license
    FROM public.licenses
    WHERE license_id = p_license_key;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'valid', false,
            'message', 'Invalid license key.',
            'customerStatus', 'invalid'
        );
    END IF;

    RETURN json_build_object(
        'valid', v_license.status = 'active' AND (v_license.expiry_date IS NULL OR v_license.expiry_date > now()),
        'edition', v_license.edition,
        'expiry', v_license.expiry_date,
        'maximumDevices', v_license.seats,
        'customerStatus', v_license.status,
        'entitlement', v_license.payload::json,
        'signature', v_license.signature,
        'message', CASE
            WHEN v_license.status != 'active' THEN 'License is ' || v_license.status
            WHEN v_license.expiry_date < now() THEN 'License has expired'
            ELSE 'License is valid'
        END
    );
END;
$$;
