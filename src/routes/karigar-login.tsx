/**
 * Karigar Portal Login — /karigar-login
 *
 * Public route — no ERP staff login required.
 * Workshop artisans authenticate via Password (Primary) or OTP (Optional).
 * On success → redirect to /karigar-portal (Job Cards, Gold Balances, Return Work).
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import {
  Mail,
  Phone,
  Lock,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Hammer,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";

export const Route = createFileRoute("/karigar-login")({
  head: () => ({
    meta: [{ title: "Karigar Portal Login · AVS Gold ERP" }],
  }),
  component: KarigarLoginPage,
});

function KarigarLoginPage() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<"password" | "otp">("password");
  const [otpMethod, setOtpMethod] = useState<"phone" | "email">("phone");

  // Password state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP state
  const [otpPhone, setOtpPhone] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // Status
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const getDialablePhone = (value: string) => {
    const trimmed = value.trim();
    return trimmed.startsWith("+") ? trimmed : "+91" + trimmed.replace(/\D/g, "");
  };

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const emailToUse = identifier.trim();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password,
      });
      if (error) throw error;
      if (data?.session) {
        void navigate({ to: "/karigar-portal" });
      }
    } catch (ex: any) {
      setErr(ex.message || "Invalid credentials. Please check your username and password.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const target = otpMethod === "phone" ? getDialablePhone(otpPhone) : otpEmail.trim();
      if (otpMethod === "phone" && target.replace(/\D/g, "").length < 12) {
        throw new Error("Enter a valid 10-digit mobile number.");
      }
      const { error } = await supabase.auth.signInWithOtp(
        otpMethod === "phone" ? { phone: target } : { email: target },
      );
      if (error) throw error;
      setOtpSent(true);
    } catch (ex: any) {
      setErr(ex.message || "Could not send verification code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const target = otpMethod === "phone" ? getDialablePhone(otpPhone) : otpEmail.trim();
      const cleaned = otpCode.trim();
      if (!/^\d{6}$/.test(cleaned)) {
        throw new Error("Enter the 6-digit verification code.");
      }
      const { error } = await supabase.auth.verifyOtp(
        otpMethod === "phone"
          ? { phone: target, token: cleaned, type: "sms" }
          : { email: target, token: cleaned, type: "email" },
      );
      if (error) throw error;
      void navigate({ to: "/karigar-portal" });
    } catch (ex: any) {
      setErr(ex.message || "Invalid or expired code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-lg border border-orange-100 p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-md">
              <Hammer className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-orange-950">Karigar Portal</h1>
              <p className="text-xs text-orange-700 mt-0.5">
                Bench jobs, gold custody, and return work submission
              </p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAuthMode("password");
                setErr(null);
              }}
              className={`flex-1 rounded-lg py-1.5 transition-all ${
                authMode === "password"
                  ? "bg-white text-orange-950 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("otp");
                setErr(null);
              }}
              className={`flex-1 rounded-lg py-1.5 transition-all ${
                authMode === "otp"
                  ? "bg-white text-orange-950 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              OTP Code
            </button>
          </div>

          {/* Password Login Form */}
          {authMode === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="karigar-identifier"
                  className="block text-xs font-semibold text-gray-700 uppercase tracking-wider"
                >
                  Email / Username
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="karigar-identifier"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="artisan@example.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="karigar-password"
                    className="block text-xs font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-orange-700 hover:text-orange-900 underline"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="karigar-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {err && <p className="text-xs text-red-600 font-medium">{err}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign In to Karigar Portal
              </button>
            </form>
          )}

          {/* OTP Login Form */}
          {authMode === "otp" && !otpSent && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setOtpMethod("phone")}
                  className={`flex-1 py-1 rounded border text-center ${otpMethod === "phone" ? "border-orange-600 bg-orange-50 text-orange-950 font-semibold" : "border-gray-200 text-gray-600"}`}
                >
                  Mobile SMS
                </button>
                <button
                  type="button"
                  onClick={() => setOtpMethod("email")}
                  className={`flex-1 py-1 rounded border text-center ${otpMethod === "email" ? "border-orange-600 bg-orange-50 text-orange-950 font-semibold" : "border-gray-200 text-gray-600"}`}
                >
                  Email
                </button>
              </div>

              {otpMethod === "phone" ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="karigar-otp-phone"
                    className="block text-xs font-semibold text-gray-700 uppercase"
                  >
                    Registered Mobile
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      id="karigar-otp-phone"
                      type="tel"
                      required
                      placeholder="98765 43210"
                      value={otpPhone}
                      onChange={(e) => setOtpPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label
                    htmlFor="karigar-otp-email"
                    className="block text-xs font-semibold text-gray-700 uppercase"
                  >
                    Registered Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      id="karigar-otp-email"
                      type="email"
                      required
                      placeholder="artisan@example.com"
                      value={otpEmail}
                      onChange={(e) => setOtpEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              )}

              {err && <p className="text-xs text-red-600 font-medium">{err}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Verification Code
              </button>
            </form>
          )}

          {/* OTP Verification */}
          {authMode === "otp" && otpSent && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex gap-3 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>Verification code sent to your phone/email.</div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="karigar-otp-code"
                  className="block text-xs font-semibold text-gray-700 uppercase"
                >
                  6-Digit OTP Code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="karigar-otp-code"
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-center tracking-widest font-mono text-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {err && <p className="text-xs text-red-600 font-medium">{err}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify &amp; Enter Workshop
              </button>

              <button
                type="button"
                onClick={() => setOtpSent(false)}
                className="w-full text-xs text-gray-500 hover:text-gray-700 underline text-center block"
              >
                Back / Resend Code
              </button>
            </form>
          )}

          {/* Footer Back Link */}
          <div className="pt-2 text-center border-t border-gray-100">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to Main Staff Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
