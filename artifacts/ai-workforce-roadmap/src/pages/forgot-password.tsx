import { useState } from "react";
import { Link } from "wouter";
import { forgotPassword, resetPassword } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrainCircuit, Loader2, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [debugToken, setDebugToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = await forgotPassword(email);
      if (result.debug_token) {
        setDebugToken(result.debug_token);
        setToken(result.debug_token);
      }
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await resetPassword(token, password);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-4">
            <BrainCircuit className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Reset password</h1>
          <p className="text-slate-400 mt-1 text-sm">
            {step === "email" ? "Enter your email to get a reset token" :
             step === "reset" ? "Enter your reset token and new password" :
             "Your password has been reset"}
          </p>
        </div>

        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-amber-500/50"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Send reset link
            </Button>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            {debugToken && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-xs text-amber-400 break-all">
                <p className="font-semibold mb-1">Dev token (no email setup):</p>
                <p className="font-mono">{debugToken}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="token" className="text-slate-300">Reset token</Label>
              <Input
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your reset token"
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-amber-500/50 font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-amber-500/50"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Reset password
            </Button>
          </form>
        )}

        {step === "done" && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle className="w-12 h-12 text-green-400" />
            </div>
            <p className="text-slate-300">Your password has been reset successfully.</p>
            <Link href="/login">
              <Button className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                Sign in
              </Button>
            </Link>
          </div>
        )}

        {step !== "done" && (
          <p className="text-center text-sm text-slate-400 mt-6">
            <Link href="/login" className="text-amber-400 hover:text-amber-300">
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
