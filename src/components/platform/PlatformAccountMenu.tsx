/**
 * Platform Owner — account summary + secure logout.
 */
import { useEffect, useState } from "react";
import { LogOut, UserCircle } from "lucide-react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AccountInfo = {
  email: string;
  name: string;
  role: string;
};

export function PlatformAccountMenu({ className }: { className?: string }) {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const role =
        (roles ?? []).find((r: { role: string }) =>
          ["saas_admin", "SaaS Admin", "platform_owner", "Platform Owner"].includes(r.role),
        )?.role ?? "Platform Owner";
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("auth_id", user.id)
        .maybeSingle();
      setAccount({
        email: user.email ?? "",
        name: (profile as { full_name?: string } | null)?.full_name || user.email || "Owner",
        role,
      });
    })();
  }, []);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      sessionStorage.clear();
      localStorage.removeItem("license-entitlement");
      window.location.replace("/");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className={cn("border-t border-border p-3 space-y-3", className)}>
      <div className="flex items-start gap-2.5 rounded-md bg-muted/30 p-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
          <UserCircle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">
            {account?.name ?? "Loading…"}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">{account?.email ?? ""}</p>
          <p className="mt-0.5 text-[10px] font-mono uppercase text-gold/80">
            {account?.role ?? "Owner"}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs gap-1.5"
        disabled={signingOut}
        onClick={() => void handleSignOut()}
      >
        <LogOut className="h-3.5 w-3.5" />
        {signingOut ? "Signing out…" : "Log out"}
      </Button>
    </div>
  );
}
