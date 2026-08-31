import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/Logo";
import { Mail, Lock, Smartphone, Send, Loader2, KeyRound, ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface DedicatedPortalLoginPageProps {
  portalType: "customer" | "supplier" | "karigar";
  title: string;
  subtitle: string;
  destinationRoute: string;
}

export function DedicatedPortalLoginPage({
  portalType,
  title,
  subtitle,
  destinationRoute,
}: DedicatedPortalLoginPageProps) {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<"password" | "otp">("password");
  const [otpChannel, setOtpChannel] = useState<"email" | "phone">("email");

  // Form states
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        toast.error(error.message || "Invalid email or password.");
        return;
      }

      if (data.session) {
        toast.success(`Welcome to your ${title}!`);
        void navigate({ to: destinationRoute as any, replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const target = otpChannel === "email" ? email.trim() : phone.trim();
    if (!target) {
      toast.error(`Please enter your ${otpChannel === "email" ? "email" : "mobile number"}.`);
      return;
    }
    setLoading(true);
    try {
      const { error } =
        otpChannel === "email"
          ? await supabase.auth.signInWithOtp({ email: target })
          : await supabase.auth.signInWithOtp({ phone: target });

      if (error) {
        toast.error(error.message || "Could not send verification code.");
        return;
      }
      setOtpSent(true);
      toast.success(`Verification code sent to ${target}!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!otpCode) {
      toast.error("Please enter the 6-digit verification code.");
      return;
    }
    setLoading(true);
    try {
      const target = otpChannel === "email" ? email.trim() : phone.trim();
      const { data, error } =
        otpChannel === "email"
          ? await supabase.auth.verifyOtp({
              email: target,
              token: otpCode.trim(),
              type: "email",
            })
          : await supabase.auth.verifyOtp({
              phone: target,
              token: otpCode.trim(),
              type: "sms",
            });

      if (error) {
        toast.error(error.message || "Invalid or expired code.");
        return;
      }

      if (data.session) {
        toast.success(`Authenticated to ${title}!`);
        void navigate({ to: destinationRoute as any, replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="flex justify-center mb-4">
          <Logo className="h-9" />
        </div>
        <h1 className="text-center text-2xl font-serif font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            {/* Mode Switch Tabs */}
            <div className="grid grid-cols-2 gap-1 bg-secondary/50 p-1 rounded-lg border border-border text-xs">
              <button
                type="button"
                onClick={() => setAuthMode("password")}
                className={`py-1.5 rounded-md font-medium transition-all ${
                  authMode === "password"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Password Login
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("otp")}
                className={`py-1.5 rounded-md font-medium transition-all ${
                  authMode === "otp"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                OTP Code
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            {authMode === "password" ? (
              <form onSubmit={handlePasswordLogin} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 text-xs h-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs">
                      Password
                    </Label>
                    <Link to="/forgot-password" className="text-[11px] text-gold hover:underline">
                      Forgot?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 text-xs h-9"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gold hover:bg-gold/90 text-black font-semibold text-xs h-9 gap-1.5 mt-2"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  Log In to {title}
                </Button>
              </form>
            ) : (
              <div className="space-y-3.5">
                {/* OTP Channel Selector */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={otpChannel === "email" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOtpChannel("email")}
                    className="flex-1 text-xs h-8"
                  >
                    <Mail className="h-3 w-3 mr-1" /> Email OTP
                  </Button>
                  <Button
                    type="button"
                    variant={otpChannel === "phone" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOtpChannel("phone")}
                    className="flex-1 text-xs h-8"
                  >
                    <Smartphone className="h-3 w-3 mr-1" /> Mobile OTP
                  </Button>
                </div>

                {otpChannel === "email" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="otpEmail" className="text-xs">
                      Email Address
                    </Label>
                    <Input
                      id="otpEmail"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="text-xs h-9"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="otpPhone" className="text-xs">
                      Mobile Number
                    </Label>
                    <Input
                      id="otpPhone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="text-xs h-9"
                    />
                  </div>
                )}

                {!otpSent ? (
                  <Button
                    type="button"
                    onClick={() => void handleSendOtp()}
                    disabled={loading}
                    className="w-full bg-gold hover:bg-gold/90 text-black font-semibold text-xs h-9 gap-1.5"
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Send Verification Code
                  </Button>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="otpCode" className="text-xs">
                        Enter 6-Digit Code
                      </Label>
                      <Input
                        id="otpCode"
                        type="text"
                        placeholder="123456"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        className="text-center font-mono tracking-widest text-base h-10"
                        autoFocus
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={loading || otpCode.length < 6}
                      className="w-full bg-gold hover:bg-gold/90 text-black font-semibold text-xs h-9 gap-1.5"
                    >
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      Verify & Log In
                    </Button>
                  </form>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-border/60 text-center text-[11px] text-muted-foreground space-y-1">
              <div>
                Staff member?{" "}
                <Link
                  to="/login"
                  search={{ redirect: "", error: "", audience: "staff" }}
                  className="text-gold font-medium hover:underline"
                >
                  ERP Staff Sign In
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
