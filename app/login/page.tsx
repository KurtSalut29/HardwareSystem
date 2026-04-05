"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { Wrench, Eye, EyeOff } from "lucide-react";

function AuthPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(false);
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
    window.location.href = `/dashboard/${data.role}`;
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
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8] p-6">
      <div
        className={`w-full max-w-sm transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      >
        {/* Logo + Store name */}
        <div
          className={`flex flex-col items-center mb-8 transition-all duration-700 delay-100 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mb-3 shadow-lg shadow-blue-500/25">
            <Wrench size={22} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">HardwareStore</h1>
          <p className="text-sm text-gray-400 mt-0.5">Management System</p>
        </div>

        {/* Tab switcher */}
        <div
          className={`flex bg-white border border-gray-200 rounded-xl p-1 mb-5 shadow-sm transition-all duration-700 delay-200 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-300 ${mode === m ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
            >
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Sliding form */}
        <div
          className={`transition-all duration-700 delay-300 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <div
            className="transition-all ease-in-out"
            style={{
              transform: animating ? (prevMode.current === "signin" ? "translateX(-16px)" : "translateX(16px)") : "translateX(0)",
              opacity: animating ? 0 : 1,
              transition: "transform 350ms ease, opacity 350ms ease",
            }}
          >
            {mode === "signin" ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8">
                <h2 className={`text-lg font-bold text-gray-900 mb-1 transition-all duration-500 ease-out ${!animating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`} style={{ transitionDelay: "80ms" }}>
                  Welcome back
                </h2>
                <p className={`text-sm text-gray-400 mb-6 transition-all duration-500 ease-out ${!animating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`} style={{ transitionDelay: "130ms" }}>
                  Enter your credentials to continue
                </p>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className={`transition-all duration-500 ease-out ${!animating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`} style={{ transitionDelay: "180ms" }}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Username</label>
                    <input type="text" value={siUsername} onChange={(e) => setSiUsername(e.target.value)} required
                      className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50 transition placeholder:text-gray-300"
                      placeholder="Enter your username" />
                  </div>

                  <div className={`transition-all duration-500 ease-out ${!animating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`} style={{ transitionDelay: "230ms" }}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Password</label>
                    <div className="relative">
                      <input type={siShowPass ? "text" : "password"} value={siPassword} onChange={(e) => setSiPassword(e.target.value)} required
                        className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50 transition placeholder:text-gray-300"
                        placeholder="Enter your password" />
                      <button type="button" onClick={() => setSiShowPass(!siShowPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                        {siShowPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {siError && <div className="bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5 text-sm text-red-500">{siError}</div>}
                  {siSuccess && <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3.5 py-2.5 text-sm text-emerald-600">{siSuccess}</div>}

                  <div className={`transition-all duration-500 ease-out ${!animating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`} style={{ transitionDelay: "280ms" }}>
                    <button type="submit" disabled={siLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-60">
                      {siLoading ? "Signing in..." : "Sign In"}
                    </button>
                  </div>
                </form>

                <p className="text-center text-sm text-gray-400 mt-5">
                  Don&apos;t have an account?{" "}
                  <button onClick={() => switchMode("signup")} className="text-blue-600 hover:underline font-medium">Sign up</button>
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-8">
                <h2 className={`text-lg font-bold text-gray-900 mb-1 transition-all duration-500 ease-out ${!animating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`} style={{ transitionDelay: "80ms" }}>
                  Create account
                </h2>
                <p className={`text-sm text-gray-400 mb-6 transition-all duration-500 ease-out ${!animating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`} style={{ transitionDelay: "130ms" }}>
                  Fill in your details to get started
                </p>

                <form onSubmit={handleSignUp} className="space-y-4">
                  {[
                    { label: "Username", name: "username", type: "text", placeholder: "Choose a username", delay: "180ms" },
                    { label: "Contact", name: "contact", type: "text", placeholder: "Phone or email (optional)", delay: "220ms" },
                  ].map(({ label, name, type, placeholder, delay }) => (
                    <div key={name} className={`transition-all duration-500 ease-out ${!animating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`} style={{ transitionDelay: delay }}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{label}</label>
                      <input type={type} value={suForm[name as keyof typeof suForm]}
                        onChange={(e) => setSuForm(p => ({ ...p, [name]: e.target.value }))}
                        required={name === "username"}
                        className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50 transition placeholder:text-gray-300"
                        placeholder={placeholder} />
                    </div>
                  ))}

                  <div className={`transition-all duration-500 ease-out ${!animating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`} style={{ transitionDelay: "260ms" }}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Role</label>
                    <select value={suForm.role} onChange={(e) => setSuForm(p => ({ ...p, role: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50 transition">
                      <option value="customer">Customer</option>
                      <option value="cashier">Cashier</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className={`transition-all duration-500 ease-out ${!animating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`} style={{ transitionDelay: "300ms" }}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Password</label>
                    <div className="relative">
                      <input type={suShowPass ? "text" : "password"} value={suForm.password}
                        onChange={(e) => setSuForm(p => ({ ...p, password: e.target.value }))} required
                        className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50 transition placeholder:text-gray-300"
                        placeholder="Create a password" />
                      <button type="button" onClick={() => setSuShowPass(!suShowPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                        {suShowPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className={`transition-all duration-500 ease-out ${!animating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`} style={{ transitionDelay: "340ms" }}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Confirm Password</label>
                    <input type="password" value={suForm.confirm}
                      onChange={(e) => setSuForm(p => ({ ...p, confirm: e.target.value }))} required
                      className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50 transition placeholder:text-gray-300"
                      placeholder="Repeat your password" />
                  </div>

                  {suError && <div className="bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5 text-sm text-red-500">{suError}</div>}

                  <div className={`transition-all duration-500 ease-out ${!animating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`} style={{ transitionDelay: "380ms" }}>
                    <button type="submit" disabled={suLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-60">
                      {suLoading ? "Creating account..." : "Sign Up"}
                    </button>
                  </div>
                </form>

                <p className="text-center text-sm text-gray-400 mt-5">
                  Already have an account?{" "}
                  <button onClick={() => switchMode("signin")} className="text-blue-600 hover:underline font-medium">Sign in</button>
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
