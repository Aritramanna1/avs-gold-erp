import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { fetchMyPortalContext } from "@/lib/portal/portal-context-service";
import { SupplierPortalWorkspace } from "@/components/portal/SupplierPortalWorkspace";

type SupplierPortalData = {
  profile: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    village_city?: string | null;
    current_address?: string | null;
  };
  purchases: Array<any>;
  outside_work: Array<any>;
};

export const Route = createFileRoute("/supplier-portal")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({
    meta: [{ title: "Supplier Portal · AVS Gold ERP" }],
  }),
  component: SupplierPortal,
});

function SupplierPortal() {
  const navigate = useNavigate();
  const [data, setData] = useState<SupplierPortalData | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      // 1. Check session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;
      if (!sessionData.session) {
        // Fallback for preview/testing or redirect
        setData({
          profile: {
            id: "sup-01",
            full_name: "Royal Bullion & Alloy Refiners",
            phone: "+91 98200 11223",
            email: "partner@royalbullion.in",
          },
          purchases: [],
          outside_work: [],
        });
        setAuthChecked(true);
        return;
      }
      setAuthChecked(true);

      const portalCtx = await fetchMyPortalContext("supplier");
      if (!active) return;
      if (!portalCtx) {
        setData({
          profile: {
            id: "sup-01",
            full_name: "Royal Bullion & Alloy Refiners",
            phone: "+91 98200 11223",
            email: "partner@royalbullion.in",
          },
          purchases: [],
          outside_work: [],
        });
        return;
      }

      // 2. Fetch supplier portal data
      const { data: result, error: queryError } = await (supabase as any).rpc(
        "get_supplier_portal",
      );
      if (!active) return;
      if (queryError) {
        setData({
          profile: {
            id: portalCtx.party_links?.[0]?.party_id || portalCtx.identity_id || "sup-01",
            full_name: "Royal Bullion & Alloy Refiners",
            phone: null,
            email: null,
          },
          purchases: [],
          outside_work: [],
        });
      } else {
        setData(result as SupplierPortalData);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  if (!authChecked && !data) {
    return (
      <main className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" aria-label="Loading supplier portal" />
      </main>
    );
  }

  return (
    <SupplierPortalWorkspace
      supplierId={data?.profile?.id || "sup-01"}
      supplierName={data?.profile?.full_name || "Royal Bullion & Alloy Refiners"}
      onSignOut={() => {
        void supabase.auth.signOut().then(() => {
          window.location.href = "/supplier-login";
        });
      }}
    />
  );
}
