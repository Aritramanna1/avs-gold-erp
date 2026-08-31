-- Portal invitations (external portal access) + hardware device registry

CREATE TABLE IF NOT EXISTS public.portal_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  party_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  portal_type TEXT NOT NULL CHECK (portal_type IN ('customer_portal', 'karigar_portal', 'supplier_portal')),
  recipient_email TEXT,
  recipient_phone TEXT,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SENT'
    CHECK (status IN ('SENT', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_portal_invitation_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_portal_invitations_firm ON public.portal_invitations (firm_id, status);
CREATE INDEX IF NOT EXISTS idx_portal_invitations_party ON public.portal_invitations (party_id);

CREATE TABLE IF NOT EXISTS public.hardware_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL DEFAULT public.my_firm_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id TEXT,
  workstation_id TEXT,
  name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN (
    'barcode_scanner', 'barcode_printer', 'label_printer', 'rfid_reader', 'rfid_scanner',
    'weighing_scale', 'pos_printer', 'a4_printer', 'customer_display', 'camera', 'signature_pad'
  )),
  provider_adapter TEXT NOT NULL DEFAULT 'generic',
  model TEXT,
  connection_type TEXT NOT NULL DEFAULT 'usb'
    CHECK (connection_type IN ('usb', 'serial', 'bluetooth', 'network', 'browser_api')),
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('unknown', 'connected', 'disconnected', 'error')),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hardware_devices_firm ON public.hardware_devices (firm_id, branch_id);

ALTER TABLE public.portal_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_invitations_firm ON public.portal_invitations;
CREATE POLICY portal_invitations_firm ON public.portal_invitations
  FOR ALL
  USING (firm_id = public.my_firm_id() OR public.is_saas_admin())
  WITH CHECK (firm_id = public.my_firm_id() OR public.is_saas_admin());

DROP POLICY IF EXISTS portal_invitations_anon_validate ON public.portal_invitations;
CREATE POLICY portal_invitations_anon_validate ON public.portal_invitations
  FOR SELECT
  USING (status = 'SENT' AND expires_at > now());

DROP POLICY IF EXISTS hardware_devices_firm ON public.hardware_devices;
CREATE POLICY hardware_devices_firm ON public.hardware_devices
  FOR ALL
  USING (firm_id = public.my_firm_id() OR public.is_saas_admin())
  WITH CHECK (firm_id = public.my_firm_id() OR public.is_saas_admin());
