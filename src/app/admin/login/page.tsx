"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, ShieldAlert, ArrowRight, UserCog } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setError("Invalid password. Check the ADMIN_PASSWORD configuration.");
    }
  };

  return (
    <div className="min-h-screen bg-graphite flex items-center justify-center px-6">
      <div className="w-full max-w-sm card-surface p-10">
        <div className="w-12 h-12 border border-copper flex items-center justify-center font-display font-bold text-copper text-xl mb-6">
          B
        </div>
        <p className="eyebrow mb-2">Belghamdi Admin</p>
        <h1 className="heading-lg text-2xl mb-8">Dashboard access</h1>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="password" className="label-dark">Admin password</label>
            <div className="relative">
              <Lock className="h-4 w-4 text-wgray-dim absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-dark pl-9"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-2 text-xs text-red-400 bg-red-400/5 border border-red-400/30 p-3">
              <ShieldAlert className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? "Verifying..." : "Sign In"} <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="flex items-center gap-2 text-[11px] text-wgray-dim mt-8 leading-relaxed">
          <UserCog className="h-4 w-4 shrink-0" />
          Demo credentials: password set via ADMIN_PASSWORD (default: belghamdi-demo)
        </p>
      </div>
    </div>
  );
}
