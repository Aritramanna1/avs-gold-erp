import { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useInstallationConfig } from "@/lib/installation-config";

interface HostDownBannerProps {
  onRetry?: () => void;
  fullScreen?: boolean;
}

export function HostDownBanner({ onRetry, fullScreen = false }: HostDownBannerProps) {
  const [retrying, setRetrying] = useState(false);
  const deploymentMode = useInstallationConfig((s) => s.deploymentMode);
  const shopName = useInstallationConfig((s) => s.businessProfile.shopName);

  async function checkHealth() {
    setRetrying(true);
    try {
      const { error } = await supabase.from("organizations").select("id").limit(1);
      if (!error) {
        if (onRetry) onRetry();
        else window.location.reload();
        return;
      }
    } catch {
      /* still offline */
    } finally {
      setTimeout(() => setRetrying(false), 800);
    }
  }

  // Auto retry every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      checkHealth();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4">
        <Card className="max-w-md w-full bg-slate-900 border-slate-800 p-6 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
            <WifiOff className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              {shopName || "MTJ ERP"} is currently offline
            </h1>
            <p className="text-sm text-slate-400">
              {deploymentMode === "local"
                ? "The shop host server is unreachable. Ensure the main host PC is powered on and connected to the shop Wi-Fi / LAN."
                : "The host server or tunnel is currently unreachable. Please try again later or check host PC connectivity."}
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={checkHealth}
              disabled={retrying}
              className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Checking connection..." : "Retry Connection"}
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Auto-reconnecting every 10 seconds...
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-amber-200 text-xs flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong>Host Unreachable:</strong> {shopName || "MTJ ERP"} host is offline. Retrying connection...
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={checkHealth}
        disabled={retrying}
        className="h-6 px-2 text-xs text-amber-300 hover:bg-amber-500/20"
      >
        <RefreshCw className={`w-3 h-3 mr-1 ${retrying ? "animate-spin" : ""}`} />
        Retry
      </Button>
    </div>
  );
}
