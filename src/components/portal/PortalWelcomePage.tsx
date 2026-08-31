import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { erpLoginUrl } from "@/lib/link-hosts";
import { Users, Hammer, Truck } from "lucide-react";

export function PortalWelcomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur px-4 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl text-gold tracking-wide">Aurum Portal</h1>
            <p className="text-xs text-muted-foreground">Customer · Karigar · Supplier access</p>
          </div>
          <a href={erpLoginUrl()}>
            <Button variant="outline" size="sm">
              Firm ERP Login
            </Button>
          </a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-3xl space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold">Welcome to your jewellery portal</h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Sign in to track orders, view statements, accept invitations, and collaborate with
              your jeweller.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5 flex flex-col items-center text-center gap-3 hover:border-gold/40 transition-colors">
              <Users className="h-8 w-8 text-gold" />
              <h3 className="font-medium">Customer</h3>
              <p className="text-xs text-muted-foreground">Orders, invoices, and repair status</p>
              <Button asChild className="w-full mt-auto min-h-11" size="sm">
                <Link to="/customer-login">Customer Login</Link>
              </Button>
            </Card>
            <Card className="p-5 flex flex-col items-center text-center gap-3 hover:border-gold/40 transition-colors">
              <Hammer className="h-8 w-8 text-gold" />
              <h3 className="font-medium">Karigar</h3>
              <p className="text-xs text-muted-foreground">Issue, return, and gold book</p>
              <Button asChild className="w-full mt-auto min-h-11" size="sm" variant="secondary">
                <Link to="/karigar-login">Karigar Login</Link>
              </Button>
            </Card>
            <Card className="p-5 flex flex-col items-center text-center gap-3 hover:border-gold/40 transition-colors">
              <Truck className="h-8 w-8 text-gold" />
              <h3 className="font-medium">Supplier</h3>
              <p className="text-xs text-muted-foreground">Purchase orders and challans</p>
              <Button asChild className="w-full mt-auto min-h-11" size="sm" variant="secondary">
                <Link to="/supplier-login">Supplier Login</Link>
              </Button>
            </Card>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Have an invitation?{" "}
            <Link to="/invite/accept" className="text-gold underline-offset-2 hover:underline">
              Accept invite
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
