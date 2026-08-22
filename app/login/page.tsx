"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { Eye, EyeOff, Package, Users2, MapPin } from "lucide-react";

function AuthPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const prevMode = useRef(mode);

  // Sign in state
  const [siUsername, setSiUsername] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siShowPass, setSiShowPass] = useState(false);
  const [siError, setSiError] = useState("");
  const [siSuccess, setSiSuccess] = useState("");
  const [siLoading, setSiLoading] = useState(false);

  // Sign up state
  const [suForm, setSuForm] = useState({ username: "", password: "", confirm: "", contact: "", role: "customer" });
  const [suShowPass, setSuShowPass] = useState(false);
  const [suError, setSuError] = useState("");
  const [suLoading, setSuLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("registered") === "1") setSiSuccess("Account created! You can now sign in.");
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  function switchMode(next: "signin" | "signup") {
    if (next === mode || animating) return;
    setAnimating(true);
    prevMode.current = mode;
    setTimeout(() => {
      setMode(next);
      setAnimating(false);
    }, 350);
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setSiError(""); setSiSuccess(""); setSiLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: siUsername, password: siPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setSiLoading(false); setSiError(data.error || "Login failed"); return; }

    const target = `/dashboard/${data.role}`;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) { window.location.href = target; return; }

    // Let the two panels finish breaking apart before the hard navigation tears the page down.
    setBreaking(true);
    setTimeout(() => { window.location.href = target; }, 1100);
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setSuError("");
    if (suForm.password !== suForm.confirm) { setSuError("Passwords do not match"); return; }
    setSuLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: suForm.username, password: suForm.password, contact: suForm.contact, role: suForm.role }),
    });
    const data = await res.json();
    setSuLoading(false);
    if (!res.ok) { setSuError(data.error || "Registration failed"); return; }
    setSiSuccess("Account created! You can now sign in.");
    switchMode("signin");
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: "var(--bg-base)" }}>
      {/* Crack of light at the seam, right as the panels start breaking apart — dead center, matching the 50/50 split below */}
      {breaking && (
        <div
          className="hidden md:block fixed inset-y-0 left-1/2 -translate-x-1/2 w-[3px] z-50 pointer-events-none animate-auth-crack-flash"
          style={{ background: "linear-gradient(var(--accent), var(--brand), var(--accent))", boxShadow: "0 0 28px 6px var(--accent)" }}
        />
      )}

      {/* Left — brand panel */}
      <div
        className={`hidden md:flex md:w-1/2 relative overflow-hidden flex-col justify-between p-10 lg:p-12 ${breaking ? "animate-auth-break-left" : ""}`}
        style={{ background: "var(--hero-bg)" }}
      >
        <div className="absolute inset-0 blueprint-grid" />
        <div
          className="absolute w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 65%)", opacity: 0.16, top: "-140px", right: "-140px" }}
        />

        <div className={`relative z-10 flex items-center gap-3 transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <Image src="/logo.png" alt="HardwareStore" width={60} height={60} className="shrink-0 object-contain" priority />
          <span className="font-display font-extrabold text-lg" style={{ color: "var(--hero-ink)" }}>HardwareStore</span>
        </div>

        <div className={`relative z-10 max-w-md transition-all duration-700 delay-150 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <h2 className="font-display text-3xl lg:text-[2.15rem] font-extrabold leading-tight mb-4" style={{ color: "var(--hero-ink)" }}>
            Run the whole branch from one screen.
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--hero-ink-dim)" }}>
            Inventory, point of sale, and live delivery tracking — built for the counter, not a boardroom.
          </p>
        </div>

        <div className={`relative z-10 flex items-center gap-8 transition-all duration-700 delay-300 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--hero-chip-bg)" }}>
              <Package size={15} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--hero-ink-dim)" }}>Inventory</p>
              <p className="text-sm font-semibold" style={{ color: "var(--hero-ink)" }}>Fractional units</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--hero-chip-bg)" }}>
              <MapPin size={15} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--hero-ink-dim)" }}>Delivery</p>
              <p className="text-sm font-semibold" style={{ color: "var(--hero-ink)" }}>Live tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--hero-chip-bg)" }}>
              <Users2 size={15} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--hero-ink-dim)" }}>Roles</p>
              <p className="text-sm font-semibold" style={{ color: "var(--hero-ink)" }}>4 supported</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className={`flex-1 flex items-center justify-center p-6 ${breaking ? "animate-auth-break-right" : ""}`}>
        <div className={`w-full max-w-sm transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          {/* Mobile-only logo */}
          <div className="flex md:hidden flex-col items-center mb-8">
            <Image src="/logo.png" alt="HardwareStore" width={96} height={96} className="object-contain mb-3" priority />
            <h1 className="font-display text-xl font-extrabold text-gray-900">HardwareStore</h1>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-6 border-b border-gray-200 mb-7">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className="pb-3 -mb-px text-sm font-bold border-b-2 transition-colors"
                style={mode === m ? { color: "#111827", borderColor: "var(--accent)" } : { color: "#9ca3af", borderColor: "transparent" }}
              >
                {m === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Sliding form */}
          <div
            style={{
              transform: animating ? (prevMode.current === "signin" ? "translateX(-16px)" : "translateX(16px)") : "translateX(0)",
              opacity: animating ? 0 : 1,
              transition: "transform 350ms ease, opacity 350ms ease",
            }}
          >
            {mode === "signin" ? (
              <div>
                <h2 className="font-display text-2xl font-extrabold text-gray-900 mb-1">Welcome back</h2>
                <p className="text-sm text-gray-400 mb-6">Enter your credentials to continue</p>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Username</label>
                    <input type="text" value={siUsername} onChange={(e) => setSiUsername(e.target.value)} required
                      className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition placeholder:text-gray-300"
                      style={{ ["--tw-ring-color" as string]: "var(--accent-soft)" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                      placeholder="Enter your username" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Password</label>
                    <div className="relative">
                      <input type={siShowPass ? "text" : "password"} value={siPassword} onChange={(e) => setSiPassword(e.target.value)} required
                        className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 transition placeholder:text-gray-300"
                        style={{ ["--tw-ring-color" as string]: "var(--accent-soft)" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                        placeholder="Enter your password" />
                      <button type="button" onClick={() => setSiShowPass(!siShowPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                        {siShowPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {siError && <div className="rounded-lg px-3.5 py-2.5 text-sm" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>{siError}</div>}
                  {siSuccess && <div className="rounded-lg px-3.5 py-2.5 text-sm" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{siSuccess}</div>}

                  <button type="submit" disabled={siLoading}
                    className="w-full rounded-lg py-2.5 text-sm font-bold transition disabled:opacity-60 active:scale-[0.98] hover:brightness-95"
                    style={{ background: "var(--accent)", color: "#ffffff" }}>
                    {siLoading ? "Signing in..." : "Sign In"}
                  </button>
                </form>

                <p className="text-center text-sm text-gray-400 mt-5">
                  Don&apos;t have an account?{" "}
                  <button onClick={() => switchMode("signup")} className="font-semibold hover:underline" style={{ color: "var(--accent-ink)" }}>Sign up</button>
                </p>
              </div>
            ) : (
              <div>
                <h2 className="font-display text-2xl font-extrabold text-gray-900 mb-1">Create account</h2>
                <p className="text-sm text-gray-400 mb-6">Fill in your details to get started</p>

                <form onSubmit={handleSignUp} className="space-y-4">
                  {[
                    { label: "Username", name: "username", type: "text", placeholder: "Choose a username" },
                    { label: "Contact", name: "contact", type: "text", placeholder: "Phone or email (optional)" },
                  ].map(({ label, name, type, placeholder }) => (
                    <div key={name}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{label}</label>
                      <input type={type} value={suForm[name as keyof typeof suForm]}
                        onChange={(e) => setSuForm(p => ({ ...p, [name]: e.target.value }))}
                        required={name === "username"}
                        className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition placeholder:text-gray-300"
                        style={{ ["--tw-ring-color" as string]: "var(--accent-soft)" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                        placeholder={placeholder} />
                    </div>
                  ))}

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Role</label>
                    <select value={suForm.role} onChange={(e) => setSuForm(p => ({ ...p, role: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition">
                      <option value="customer">Customer</option>
                      <option value="cashier">Cashier</option>
                      <option value="driver">Driver</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Password</label>
                    <div className="relative">
                      <input type={suShowPass ? "text" : "password"} value={suForm.password}
                        onChange={(e) => setSuForm(p => ({ ...p, password: e.target.value }))} required
                        className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 transition placeholder:text-gray-300"
                        style={{ ["--tw-ring-color" as string]: "var(--accent-soft)" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                        placeholder="Create a password" />
                      <button type="button" onClick={() => setSuShowPass(!suShowPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                        {suShowPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Confirm Password</label>
                    <input type="password" value={suForm.confirm}
                      onChange={(e) => setSuForm(p => ({ ...p, confirm: e.target.value }))} required
                      className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition placeholder:text-gray-300"
                      style={{ ["--tw-ring-color" as string]: "var(--accent-soft)" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                      placeholder="Repeat your password" />
                  </div>

                  {suError && <div className="rounded-lg px-3.5 py-2.5 text-sm" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>{suError}</div>}

                  <button type="submit" disabled={suLoading}
                    className="w-full rounded-lg py-2.5 text-sm font-bold transition disabled:opacity-60 active:scale-[0.98] hover:brightness-95"
                    style={{ background: "var(--accent)", color: "#ffffff" }}>
                    {suLoading ? "Creating account..." : "Create Account"}
                  </button>
                </form>

                <p className="text-center text-sm text-gray-400 mt-5">
                  Already have an account?{" "}
                  <button onClick={() => switchMode("signin")} className="font-semibold hover:underline" style={{ color: "var(--accent-ink)" }}>Sign in</button>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <AuthPage />
    </Suspense>
  );
}
