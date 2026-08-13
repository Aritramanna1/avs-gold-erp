/**
 * Karigar Login — /karigar-login
 *
 * Public route — no ERP staff login required.
 * Karigar workers authenticate via Supabase email or mobile OTP.
 * The system matches their email against the `people` table to find
 * their karigar record and load their gold balance / wages.
 *
 * On success → redirect to /karigar-portal
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Hammer, ArrowLeft, CheckCircle2, Loader2, Mail, Phone } from "lucide-react";

export const Route = createFileRoute("/karigar-login")({
  head: () => ({
    meta: [{ title: "Karigar Portal Login · AVS Gold ERP" }],
  }),
  component: KarigarLoginPage,
});

function KarigarLoginPage() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const getDialablePhone = (value: string) => {
    const trimmed = value.trim();
    return trimmed.startsWith("+") ? trimmed : "+91" + trimmed.replace(/\D/g, "");
  };
  const destination = method === "email" ? email.trim() : getDialablePhone(phone);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (method === "phone" && destination.replace(/\D/g, "").length < 12) {
        throw new Error("Enter a valid mobile number with 10 digits.");
      }
      const { error } = await supabase.auth.signInWithOtp(
        method === "email" ? { email: destination } : { phone: destination },
      );
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
      const cleanedOtp = otp.trim();
      if (!/^\d{6}$/.test(cleanedOtp)) {
        throw new Error("Enter the 6-digit verification code.");
      }
      const { error } = await supabase.auth.verifyOtp(
        method === "email"
          ? { email: destination, token: cleanedOtp, type: "email" }
          : { phone: destination, token: cleanedOtp, type: "sms" },
      );
      if (error) throw error;
      void navigate({ to: "/karigar-portal" });
    } catch (ex: any) {
      setErr(ex.message || "Invalid or expired code. Please try again.");
    } finally {
      setVerifyBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4">
      <div className="w-full max-w-sm">
        {/* Header card */}
        <div className="bg-white rounded-2xl shadow-lg border border-orange-100 p-8 space-y-6">
          {/* Logo mark */}
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-md">
              <Hammer className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-orange-900">Karigar Portal</h1>
              <p className="text-xs text-orange-700 mt-0.5">
                View your gold balance, wages &amp; attendance
              </p>
            </div>
          </div>

          {/* Method selector */}
          {!sent && (
            <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setMethod("email");
                  setErr(null);
                }}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  method === "email"
                    ? "bg-white text-orange-950 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Email OTP
              </button>
              <button
                type="button"
                onClick={() => {
                  setMethod("phone");
                  setErr(null);
                }}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  method === "phone"
                    ? "bg-white text-orange-950 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Mobile OTP
              </button>
            </div>
          )}

          {/* Form */}
          {!sent ? (
            <form onSubmit={handleSend} className="space-y-4">
              {method === "email" ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="karigar-email"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      id="karigar-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-gray-400">Use the email registered by your firm</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label
                    htmlFor="karigar-phone"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      id="karigar-phone"
                      type="tel"
                      required
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-gray-400">Use the phone registered by your firm</p>
                </div>
              )}

              {err && <p className="text-xs text-red-600 font-medium leading-relaxed">{err}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
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
                  A 6-digit code was sent to{" "}
                  <strong className="break-all">{method === "email" ? email : phone}</strong>. Check
                  your inbox.
                </div>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="karigar-otp" className="block text-sm font-medium text-gray-700">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="karigar-otp"
                    type="text"
                    required
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {err && <p className="text-xs text-red-600 font-medium leading-relaxed">{err}</p>}

                <button
                  type="submit"
                  disabled={verifyBusy}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
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
                Use a different {method === "email" ? "email" : "number"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by <span className="font-semibold text-orange-700">AVS Gold ERP</span>
        </p>
      </div>
    </div>
  );
}
