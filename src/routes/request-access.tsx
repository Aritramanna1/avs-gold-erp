/**
 * Public visitors cannot self-register. Request access or use an authorized invitation.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Mail, LogIn, UserCheck } from "lucide-react";
import { PUBLIC_SIGNUP_DISABLED_MESSAGE } from "@/lib/auth/public-signup-policy";

export const Route = createFileRoute("/request-access")({
  head: () => ({ meta: [{ title: "Request Access · AVS ERP" }] }),
  component: RequestAccessPage,
});

function RequestAccessPage() {
  return (
    <MarketingLayout>
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-8">
        <div className="text-center space-y-3">
          <ShieldCheck className="mx-auto h-10 w-10 text-gold" />
          <h1 className="font-serif text-3xl text-foreground">Request AVS ERP Access</h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-lg mx-auto">
            {PUBLIC_SIGNUP_DISABLED_MESSAGE}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How to get access</CardTitle>
            <CardDescription>
              Only an authorized AVS or company administrator can invite you. There is no public
              sign-up or self-service trial.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button asChild variant="default" className="gap-2 h-auto py-3 flex-col items-start">
              <Link to="/invite/accept">
                <UserCheck className="h-4 w-4 mb-1" />
                <span className="font-semibold">Accept invitation</span>
                <span className="text-xs font-normal opacity-90">
                  Have a secure invite link or code from your jeweller
                </span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2 h-auto py-3 flex-col items-start">
              <Link to="/login" search={{ redirect: "", error: "", audience: undefined }}>
                <LogIn className="h-4 w-4 mb-1" />
                <span className="font-semibold">Sign in</span>
                <span className="text-xs font-normal opacity-90">
                  Already have an account? Sign in to your workspace
                </span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2 h-auto py-3 flex-col items-start">
              <Link to="/contact" search={{ intent: "access" }}>
                <Mail className="h-4 w-4 mb-1" />
                <span className="font-semibold">Request access</span>
                <span className="text-xs font-normal opacity-90">
                  Contact AVS to discuss onboarding for your workshop
                </span>
              </Link>
            </Button>
            <Button asChild variant="ghost" className="gap-2 h-auto py-3 flex-col items-start">
              <Link to="/support">
                <span className="font-semibold">Contact support</span>
                <span className="text-xs font-normal opacity-90">
                  Help with login, invitations, or access issues
                </span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </MarketingLayout>
  );
}
