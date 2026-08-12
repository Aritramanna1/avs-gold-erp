/**
 * Customer Login — /customer-login
 *
 * Public route — no ERP staff login required.
 * Customers authenticate via email OTP (Supabase Magic Link / OTP).
 * On success → redirect to /customer-portal which shows their invoices, orders, repairs.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Mail, ArrowLeft, CheckCircle2, Loader2, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/customer-login")({
  head: () => ({
    meta: [{ title: "Customer Login · AVS Gold ERP" }],
  }),
  component: CustomerLoginPage,
});

function CustomerLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setSent(true);
    } catch (ex: any) {
      setErr(ex.message || "Could not send the verification code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setVerifyBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
      if (error) throw error;
      void navigate({ to: "/customer-portal" });
    } catch (ex: any) {
      setErr(ex.message || "Invalid or expired code. Please try again.");
    } finally {
      setVerifyBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-amber-50 px-4">
      <div className="w-full max-w-sm">
        {/* Header card */}
        <div className="bg-white rounded-2xl shadow-lg border border-amber-100 p-8 space-y-6">
          {/* Logo mark */}
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-md">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-amber-900">Customer Portal</h1>
              <p className="text-xs text-amber-700 mt-0.5">
                View your orders, invoices &amp; repairs
              </p>
            </div>
          </div>

          {/* Form */}
          {!sent ? (
            <form onSubmit={handleSend} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="customer-email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="customer-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>

              {err && <p className="text-xs text-red-600 font-medium leading-relaxed">{err}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Verification Code
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-emerald-800">
                  A 6-digit code was sent to <strong className="break-all">{email}</strong>. Check
                  your inbox or spam folder.
                </div>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="customer-otp" className="block text-sm font-medium text-gray-700">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="customer-otp"
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>

                {err && <p className="text-xs text-red-600 font-medium leading-relaxed">{err}</p>}

                <button
                  type="submit"
                  disabled={verifyBusy}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {verifyBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Verify &amp; Enter Portal
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setOtp("");
                  setErr(null);
                }}
                className="w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Use a different email
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by <span className="font-semibold text-amber-700">AVS Gold ERP</span>
        </p>
      </div>
    </div>
  );
}
