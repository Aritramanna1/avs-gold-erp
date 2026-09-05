import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthNativeBrandHeader, AuthNativeShell } from "@/components/layout/AuthNativeShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Mail, ArrowRight, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/request-access")({
  head: () => ({ meta: [{ title: "Request Access · AVS ERP" }] }),
  component: RequestAccessPage,
});

function RequestAccessPage() {
  const navigate = useNavigate();

  return (
    <AuthNativeShell>
      <div className="mx-auto w-full max-w-md space-y-6">
        <AuthNativeBrandHeader />
        <Card className="border-white/15 bg-[#14110f] p-6 text-white space-y-4">
          <div className="flex items-center gap-2 text-gold">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="font-serif text-lg font-semibold">Access by Invitation Only</h2>
          </div>
          <p className="text-xs text-white/75 leading-relaxed">
            AVS ERP is an enterprise jewellery platform with strict tenant isolation. To join a workshop or access customer/karigar portals, you must receive an authorized invitation from the firm administrator.
          </p>
          <div className="space-y-2 pt-2">
            <Button
              className="w-full bg-gold hover:bg-gold-600 text-slate-950 font-semibold gap-2"
              onClick={() => void navigate({ to: "/invite/accept" })}
            >
              I Have an Invitation Code <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10"
              onClick={() => void navigate({ to: "/login" as any })}
            >
              Sign In to Existing Account
            </Button>
          </div>
          <div className="border-t border-white/10 pt-4 text-center">
            <p className="text-[11px] text-white/60 mb-2">Need a business license for your jewellery firm?</p>
            <a
              href="mailto:contact@arivahly.in?subject=AVS%20ERP%20Access%20Request"
              className="text-xs text-gold underline underline-offset-4 flex items-center justify-center gap-1 hover:text-gold-400"
            >
              <Mail className="h-3.5 w-3.5" /> /contact — Contact Enterprise Sales
            </a>
          </div>
        </Card>
        <div className="text-center">
          <button
            type="button"
            onClick={() => void navigate({ to: "/login" as any })}
            className="text-xs text-white/75 hover:text-white flex items-center gap-1 mx-auto"
          >
            <ArrowLeft className="h-3 w-3" /> Back to /login
          </button>
        </div>
      </div>
    </AuthNativeShell>
  );
}
