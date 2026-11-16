"use client";

import { useState, FormEvent, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Eye, EyeOff, ArrowLeft, ArrowRight, User, Lock, Phone, ShieldCheck, ShoppingBag, Truck, Tag, Wallet,
  MapPin, UserPlus, LogIn, Mail, Check, Circle, MailCheck, Clock, type LucideIcon,
} from "lucide-react";
import { STORE_NAME } from "@/lib/brand";
import LocationPicker, { type PickedLocation } from "@/components/LocationPicker";
import {
  SUFFIXES, PASSWORD_RULES, PHONE_HINT, cleanName, fullName, nameProblem, normalizeEmail, normalizePhone, passwordProblem,
} from "@/lib/validation";

type Mode = "signin" | "signup";

// The same tool-wall photo as the landing page hero, so the storefront and sign-in feel like one place.
const AUTH_IMAGE = "/images/hero-tool-wall.jpg";

// What the photo panel says for each tab. `accent` is the highlighted word in the headline.
const PANEL: Record<Mode, {
  eyebrow: string;
  title: [string, string, string];
  body: string;
  points: [LucideIcon, string, string][];
}> = {
  signin: {
    eyebrow: "Welcome back",
    title: ["Back to the ", "counter", "."],
    body: "Sign in to manage stock, ring up sales, or follow your delivery on the map.",
    points: [
      [ShieldCheck, "Admin & Staff", "Stock, sales, reports"],
      [ShoppingBag, "Customers", "Order and track"],
      [Truck, "Drivers", "Today's deliveries"],
    ],
  },
  signup: {
    eyebrow: "New customer",
    title: ["Your hardware list, ", "delivered", "."],
    body: "Create a free account to order online, for delivery to the spot you pin or pickup at the store.",
    points: [
      [Tag, "Today's prices", "Straight from the shelf"],
      [Truck, "Delivery or pickup", "Whichever suits you"],
      [Wallet, "Cash or GCash", "Pay your way"],
    ],
  },
};

const FORM_HEAD: Record<Mode, { title: string; body: string }> = {
  signin: { title: "Welcome back", body: "Sign in with the email and password for your account." },
  signup: { title: "Create your account", body: "Three quick steps. The store approves new accounts, and we email you when yours is ready." },
};

// `auth-input` (globals.css) keeps the browser's autofill from painting the field blue.
const INPUT_CLASS =
  "auth-input w-full h-12 rounded-xl border pl-11 text-sm transition-colors bg-[color:var(--bg-subtle)] border-[color:var(--border)] " +
  "text-[color:var(--text-primary)] placeholder:text-[color:var(--text-faint)] hover:border-[color:var(--border-strong)] " +
  "focus:outline-none focus:bg-[color:var(--bg-card)] focus:border-[color:var(--brand)] focus:ring-4 focus:ring-[color:var(--brand-soft)]";

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg-card)]";

const PRIMARY_BUTTON =
  `group w-full h-12 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-bold text-white transition ` +
  `disabled:opacity-60 active:scale-[0.98] hover:brightness-110 hover:shadow-[0_14px_28px_-12px_rgba(30,79,216,0.75)] ${FOCUS_RING}`;
const PRIMARY_BUTTON_STYLE: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--brand) 0%, var(--info) 100%)",
  boxShadow: "0 10px 22px -12px rgba(30,79,216,0.6), inset 0 1px 0 rgba(255,255,255,0.18)",
};

function Field({
  id, label, icon: Icon, hint, trailing, ...input
}: { id: string; label: string; icon: LucideIcon; hint?: string; trailing?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {label}
      </label>
      <div className="relative">
        <input id={id} {...input} className={`peer ${INPUT_CLASS} ${trailing ? "pr-12" : "pr-4"}`} />
        <Icon size={17} aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors text-[color:var(--text-faint)] peer-focus:text-[color:var(--brand)]" />
        {trailing}
      </div>
      {hint && <p className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  );
}

function RevealButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      aria-pressed={shown}
      className={`absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center transition-colors text-[color:var(--text-faint)] hover:text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)] ${FOCUS_RING}`}
    >
      {shown ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
}

function SelectField({ id, label, hint, children, ...select }: { id: string; label: string; hint?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
      <select id={id} {...select} className={`${INPUT_CLASS} pl-4 pr-4 appearance-none cursor-pointer`}>{children}</select>
      {hint && <p className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  );
}

const SIGNUP_STEPS = ["Your name", "Contact & address", "Password"] as const;

/** Where the visitor is in the three signup steps. */
function StepHeader({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 mb-6" aria-label="Signup steps">
      {SIGNUP_STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={label} className="flex-1 min-w-0" aria-current={current ? "step" : undefined}>
            <div className="h-1.5 rounded-full transition-colors" style={{ background: done || current ? "var(--brand)" : "var(--border)" }} />
            <p className="mt-1.5 text-[11px] font-semibold truncate" style={{ color: current ? "var(--brand)" : done ? "var(--text-secondary)" : "var(--text-faint)" }}>
              {i + 1}. {label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

type SignupForm = {
  firstName: string; middleName: string; lastName: string; suffix: string;
  contact: string; email: string; password: string; confirm: string;
};
const EMPTY_SIGNUP: SignupForm = { firstName: "", middleName: "", lastName: "", suffix: "", contact: "", email: "", password: "", confirm: "" };

/** The first problem on a signup step, checked with the same rules the server uses. */
function stepProblem(step: number, f: SignupForm, location: PickedLocation | null): string | null {
  if (step === 0) {
    return nameProblem(cleanName(f.firstName), "first name", true)
      ?? nameProblem(cleanName(f.middleName), "middle name", false)
      ?? nameProblem(cleanName(f.lastName), "last name", true);
  }
  if (step === 1) {
    if (!normalizePhone(f.contact)) return `Enter a valid mobile number: ${PHONE_HINT}.`;
    if (!normalizeEmail(f.email)) return "Enter a valid email address, e.g. juan.delacruz@gmail.com.";
    if (!location) return "Pin your home or usual delivery spot on the map.";
    return null;
  }
  const pw = passwordProblem(f.password);
  if (pw) return pw;
  if (f.password !== f.confirm) return "The two passwords don't match.";
  return null;
}

function Notice({ tone, children }: { tone: "bad" | "good" | "info"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className="rounded-xl px-4 py-3 text-sm font-medium border animate-rise-in"
      style={{
        background: `var(--${tone}-soft)`,
        color: `var(--${tone})`,
        borderColor: `color-mix(in srgb, var(--${tone}) 22%, transparent)`,
      }}
    >
      {children}
    </div>
  );
}

// Store badge over the photo: logo, name and where the store is, set straight on the image.
function StoreBadge({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-3 rounded-xl transition-transform hover:-translate-y-0.5 ${FOCUS_RING}`}
      style={{ textShadow: "0 1px 12px rgba(0,0,0,0.45)" }}
    >
      <Image
        src="/logo.png" alt="" width={compact ? 36 : 46} height={compact ? 36 : 46}
        className="object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]" priority
      />
      <span className="flex flex-col leading-none">
        <span className={`font-display font-extrabold text-white ${compact ? "text-sm" : "text-lg"}`}>{STORE_NAME}</span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.78)" }}>
          Hardware · Building supply
        </span>
      </span>
      {!compact && (
        <>
          <span aria-hidden className="mx-1.5 h-8 w-px" style={{ background: "rgba(255,255,255,0.35)" }} />
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
            <MapPin size={13} style={{ color: "#9DB8FF" }} /> Brgy. Sanggalang, Biliran
          </span>
        </>
      )}
    </Link>
  );
}

function AuthPage() {
  const searchParams = useSearchParams();
  // The landing page links straight to the signup tab with ?mode=signup.
  const [mode, setMode] = useState<Mode>(() => (searchParams.get("mode") === "signup" ? "signup" : "signin"));
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(false);
  const [breaking, setBreaking] = useState(false);
  // The tab being left, so the form slides out in the right direction.
  const [leaving, setLeaving] = useState<Mode>("signin");

  // Sign in state
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siShowPass, setSiShowPass] = useState(false);
  const [siError, setSiError] = useState("");
  // Signed in with the right password, but the account isn't approved yet.
  const [siWaiting, setSiWaiting] = useState("");
  const [siSuccess, setSiSuccess] = useState(() => (searchParams.get("registered") === "1" ? "Account created! You can now sign in." : ""));
  const [siLoading, setSiLoading] = useState(false);

  // Sign up state
  const [suForm, setSuForm] = useState<SignupForm>(EMPTY_SIGNUP);
  const [suLocation, setSuLocation] = useState<PickedLocation | null>(null);
  const [suStep, setSuStep] = useState(0);
  const [suShowPass, setSuShowPass] = useState(false);
  const [suError, setSuError] = useState("");
  const [suLoading, setSuLoading] = useState(false);
  // After registering: which email we wrote to, and whether the email went out.
  const [suDone, setSuDone] = useState<{ email: string; emailSent: boolean } | null>(null);
  const setSu = (k: keyof SignupForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSuForm((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  function switchMode(next: Mode) {
    if (next === mode || animating) return;
    setAnimating(true);
    setLeaving(mode);
    setTimeout(() => {
      setMode(next);
      setAnimating(false);
    }, 350);
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setSiError(""); setSiSuccess(""); setSiWaiting(""); setSiLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: siEmail, password: siPassword }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) {
      setSiLoading(false);
      if (data.status === "pending") setSiWaiting(data.error);
      else setSiError(data.error || (res ? "Sign-in failed. Please try again." : "Can't reach the server. Check your connection."));
      return;
    }

    // A visitor who tapped "Order" on the landing page is sent straight to the
    // shop once they're in. Only same-origin relative paths are honoured, and
    // only for customers, so ?next= can't be used to push staff somewhere odd.
    const next = searchParams.get("next");
    const target =
      data.role === "customer" && next && next.startsWith("/") && !next.startsWith("//")
        ? next
        : `/dashboard/${data.role}`;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) { window.location.href = target; return; }

    // Let the two panels finish breaking apart before the hard navigation tears the page down.
    setBreaking(true);
    setTimeout(() => { window.location.href = target; }, 1100);
  }

  function nextStep(e: FormEvent) {
    e.preventDefault();
    const problem = stepProblem(suStep, suForm, suLocation);
    if (problem) { setSuError(problem); return; }
    setSuError("");
    setSuStep((n) => n + 1);
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    for (const step of [0, 1, 2]) {
      const problem = stepProblem(step, suForm, suLocation);
      if (problem) { setSuStep(step); setSuError(problem); return; }
    }
    setSuError("");
    setSuLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // No role is sent — public signup always creates a customer. Staff and
      // driver accounts are created by the admin on the Users page.
      body: JSON.stringify({
        firstName: suForm.firstName, middleName: suForm.middleName, lastName: suForm.lastName, suffix: suForm.suffix,
        contact: suForm.contact, email: suForm.email, password: suForm.password,
        defaultAddress: suLocation?.address, defaultLat: suLocation?.lat, defaultLng: suLocation?.lng,
      }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setSuLoading(false);
    if (!res || !res.ok) {
      // Send them back to the step with the problem.
      const stepOf: Record<string, number> = { name: 0, contact: 1, location: 1, password: 2 };
      if (data.field && data.field in stepOf) setSuStep(stepOf[data.field]);
      setSuError(data.error || "Registration failed. Please try again.");
      return;
    }
    setSuDone({ email: data.email, emailSent: Boolean(data.emailSent) });
    setSuForm(EMPTY_SIGNUP); setSuLocation(null); setSuStep(0);
  }

  const panel = PANEL[mode];
  const head = FORM_HEAD[mode];
  // The tab the visitor picked. During the slide-out the form still shows the old tab,
  // but the switcher's pill should already be moving to the new one.
  const targetTab: Mode = animating ? (leaving === "signin" ? "signup" : "signin") : mode;
  const fadeIn = (delay: string) =>
    `transition-all duration-700 ${delay} ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`;

  return (
    // overflow-x-clip (not overflow-hidden) hides the panels as they break apart without
    // turning this box into a scroll container, which would stop the photo panel sticking.
    <div className="min-h-screen grid md:grid-cols-2 relative overflow-x-clip" style={{ background: "var(--bg-base)" }}>
      {/* Crack of light at the seam, right as the panels start breaking apart — dead center, matching the 50/50 split */}
      {breaking && (
        <div
          className="hidden md:block fixed inset-y-0 left-1/2 -translate-x-1/2 w-[3px] z-50 pointer-events-none animate-auth-crack-flash"
          style={{ background: "linear-gradient(var(--brand-soft), var(--brand), var(--brand-soft))", boxShadow: "0 0 28px 6px var(--brand)" }}
        />
      )}

      {/* Left — photo panel. Sticky and one screen tall, so it stays whole while a long form scrolls. */}
      <aside className={`hidden md:block relative md:sticky md:top-0 md:h-screen self-start overflow-hidden ${breaking ? "animate-auth-break-left" : ""}`}>
        <Image src={AUTH_IMAGE} alt="" fill priority quality={90} sizes="50vw" className="object-cover object-center animate-ken-burns" />
        {/* Shaded at the top and bottom, where the text sits, and clear in the middle so the tools show. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(9,12,24,0.55) 0%, rgba(9,12,24,0.08) 26%, rgba(9,12,24,0.12) 45%, rgba(9,12,24,0.78) 78%, rgba(9,12,24,0.9) 100%)" }}
        />

        <div className="relative h-full flex flex-col justify-between p-8 lg:p-10">
          <div className={`self-start ${fadeIn("")}`}>
            <StoreBadge />
          </div>

          <div
            className={fadeIn("delay-150")}
            style={{ opacity: animating ? 0 : undefined, transition: animating ? "opacity 300ms ease" : undefined }}
          >
            <div key={mode} className="max-w-lg animate-rise-in" style={{ textShadow: "0 1px 12px rgba(0,0,0,0.45)" }}>
              <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#8FB0FF", boxShadow: "0 0 0 3px rgba(143,176,255,0.25)" }} />
                {panel.eyebrow}
              </span>
              <h2
                className="mt-4 font-display text-4xl lg:text-[2.9rem] font-extrabold leading-[1.05] tracking-tight text-white text-balance animate-rise-in"
                style={{ animationDelay: "80ms" }}
              >
                {panel.title[0]}
                <span style={{ color: "#9DB8FF" }}>{panel.title[1]}</span>
                {panel.title[2]}
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed animate-rise-in" style={{ color: "rgba(255,255,255,0.88)", animationDelay: "160ms" }}>
                {panel.body}
              </p>

              <ul className="mt-7 pt-6 grid grid-cols-3 border-t" style={{ borderColor: "rgba(255,255,255,0.22)" }}>
                {panel.points.map(([Icon, title, sub], i) => (
                  <li
                    key={title}
                    className={`min-w-0 animate-rise-in ${i > 0 ? "pl-4 border-l" : "pr-4"} ${i === 1 ? "pr-4" : ""}`}
                    style={{ borderColor: "rgba(255,255,255,0.22)", animationDelay: `${240 + i * 90}ms` }}
                  >
                    <Icon size={20} style={{ color: "#9DB8FF" }} className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" />
                    <p className="mt-3 text-[13px] font-bold text-white leading-tight">{title}</p>
                    <p className="mt-1 text-xs leading-snug" style={{ color: "rgba(255,255,255,0.75)" }}>{sub}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </aside>

      {/* Right — form */}
      <main className={`flex flex-col min-h-screen ${breaking ? "animate-auth-break-right" : ""}`}>
        {/* Phones get a short photo banner in place of the side panel. */}
        <div className="md:hidden relative h-44 overflow-hidden">
          <Image src={AUTH_IMAGE} alt="" fill priority quality={90} sizes="100vw" className="object-cover object-center animate-ken-burns" />
          <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(9,12,24,0.1), rgba(9,12,24,0.5))" }} />
          <div className="absolute left-4 bottom-4">
            <StoreBadge compact />
          </div>
        </div>

        <div className="px-6 sm:px-10 pt-6 md:pt-8">
          {/* Back to the public storefront — visitors reach this page from the
              landing page and need a way back without using the browser button. */}
          <Link
            href="/"
            className={`group inline-flex items-center gap-1.5 text-sm font-semibold rounded-md transition-colors text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] ${FOCUS_RING}`}
          >
            <ArrowLeft size={15} className="transition-transform duration-200 group-hover:-translate-x-1" /> Back to store
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 sm:px-10 py-8">
          <div
            className={`w-full ${mode === "signup" ? "max-w-[540px]" : "max-w-[440px]"} rounded-3xl border p-6 sm:p-9 transition-[max-width] duration-300 ${fadeIn("")}`}
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border)",
              boxShadow: "0 30px 70px -36px rgba(16,24,64,0.4), 0 2px 6px rgba(16,24,64,0.04)",
            }}
          >
            {/* Tab switcher */}
            <div role="tablist" aria-label="Account" className="relative grid grid-cols-2 p-1 rounded-xl" style={{ background: "var(--bg-muted)" }}>
              <span
                aria-hidden
                className="nav-indicator absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg shadow-[0_2px_6px_rgba(16,24,64,0.14)]"
                style={{ background: "var(--bg-card)", transform: targetTab === "signin" ? "translateX(0)" : "translateX(100%)" }}
              />
              {(["signin", "signup"] as const).map((m) => {
                const selected = targetTab === m;
                const TabIcon = m === "signin" ? LogIn : UserPlus;
                return (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => switchMode(m)}
                    className={`relative z-[1] h-10 rounded-lg inline-flex items-center justify-center gap-2 text-sm font-bold transition-colors duration-300 ${FOCUS_RING} ${
                      selected ? "text-[color:var(--brand)]" : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
                    }`}
                  >
                    <TabIcon size={15} />
                    {m === "signin" ? "Sign in" : "Create account"}
                  </button>
                );
              })}
            </div>

            {/* Sliding form */}
            <div
              role="tabpanel"
              className="mt-8"
              style={{
                transform: animating ? (leaving === "signin" ? "translateX(-16px)" : "translateX(16px)") : "translateX(0)",
                opacity: animating ? 0 : 1,
                transition: "transform 350ms ease, opacity 350ms ease",
              }}
            >
              <div className="mb-7 text-center">
                <h1 className="font-display text-[1.9rem] leading-tight font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  {head.title}
                </h1>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{head.body}</p>
              </div>

              {mode === "signin" ? (
                <div>
                  <form onSubmit={handleSignIn} className="space-y-5">
                    <Field
                      id="si-email" label="Email" icon={Mail} type="text" inputMode="email" autoComplete="username" required
                      value={siEmail} onChange={(e) => setSiEmail(e.target.value)} placeholder="yourname@gmail.com"
                      hint="Staff accounts without an email on file can use their username."
                    />
                    <Field
                      id="si-password" label="Password" icon={Lock} type={siShowPass ? "text" : "password"} autoComplete="current-password" required
                      value={siPassword} onChange={(e) => setSiPassword(e.target.value)} placeholder="Enter your password"
                      trailing={<RevealButton shown={siShowPass} onToggle={() => setSiShowPass(!siShowPass)} />}
                    />

                    {siError && <Notice tone="bad">{siError}</Notice>}
                    {siWaiting && (
                      <Notice tone="info">
                        <span className="flex items-start gap-2"><Clock size={16} className="shrink-0 mt-0.5" /> {siWaiting}</span>
                      </Notice>
                    )}
                    {siSuccess && <Notice tone="good">{siSuccess}</Notice>}

                    <button type="submit" disabled={siLoading} className={PRIMARY_BUTTON} style={PRIMARY_BUTTON_STYLE}>
                      {siLoading ? "Signing in..." : <>Sign in <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" /></>}
                    </button>
                  </form>

                  <p className="mt-4 flex items-center justify-center gap-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
                    <ShieldCheck size={13} /> Your password is never stored as plain text.
                  </p>

                  <div className="mt-7 pt-6 border-t text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    New to {STORE_NAME}?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className={`group inline-flex items-center gap-1 font-bold rounded ${FOCUS_RING}`}
                      style={{ color: "var(--brand)" }}
                    >
                      Create an account <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {suDone ? (
                    <div className="text-center py-2 animate-rise-in" role="status">
                      <span className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--good-soft)", color: "var(--good)" }}>
                        <MailCheck size={28} />
                      </span>
                      <h2 className="mt-4 font-display text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>Registration received</h2>
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        The store will review your account first. {suDone.emailSent
                          ? <>We sent a confirmation to <b style={{ color: "var(--text-primary)" }}>{suDone.email}</b>, and we&apos;ll email you again once it&apos;s approved.</>
                          : <>Once it&apos;s approved, you can sign in with <b style={{ color: "var(--text-primary)" }}>{suDone.email}</b>.</>}
                      </p>
                      <button type="button" onClick={() => { setSiEmail(suDone.email); setSuDone(null); switchMode("signin"); }}
                        className={`${PRIMARY_BUTTON} mt-6`} style={PRIMARY_BUTTON_STYLE}>
                        Back to sign in <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                      </button>
                    </div>
                  ) : (
                  <form onSubmit={suStep < 2 ? nextStep : handleSignUp} className="space-y-5" noValidate>
                    <StepHeader step={suStep} />

                    {suStep === 0 && (
                      <div className="space-y-5 animate-rise-in">
                        <div className="grid sm:grid-cols-2 gap-5 sm:gap-3">
                          <Field id="su-first" label="First name" icon={User} autoComplete="given-name" required maxLength={50}
                            value={suForm.firstName} onChange={setSu("firstName")} placeholder="Juan" />
                          <Field id="su-last" label="Last name" icon={User} autoComplete="family-name" required maxLength={50}
                            value={suForm.lastName} onChange={setSu("lastName")} placeholder="Dela Cruz" />
                        </div>
                        <div className="grid sm:grid-cols-[1fr_9rem] gap-5 sm:gap-3">
                          <Field id="su-middle" label="Middle name (optional)" icon={User} autoComplete="additional-name" maxLength={50}
                            value={suForm.middleName} onChange={setSu("middleName")} placeholder="Santos" />
                          <SelectField id="su-suffix" label="Suffix" value={suForm.suffix} onChange={setSu("suffix")}>
                            <option value="">None</option>
                            {SUFFIXES.map((x) => <option key={x} value={x}>{x}</option>)}
                          </SelectField>
                        </div>
                        {(suForm.firstName.trim() || suForm.lastName.trim()) && (
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            You&apos;ll show up to the store as{" "}
                            <b style={{ color: "var(--text-primary)" }}>
                              {fullName({ firstName: cleanName(suForm.firstName) || "…", middleName: cleanName(suForm.middleName), lastName: cleanName(suForm.lastName) || "…", suffix: suForm.suffix })}
                            </b>.
                          </p>
                        )}
                      </div>
                    )}

                    {suStep === 1 && (
                      <div className="space-y-5 animate-rise-in">
                        <div className="grid sm:grid-cols-2 gap-5 sm:gap-3">
                          <Field id="su-contact" label="Mobile number" icon={Phone} type="tel" inputMode="numeric" autoComplete="tel" required maxLength={16}
                            value={suForm.contact} onChange={setSu("contact")} placeholder="0917 123 4567" hint="11 digits, starts with 09." />
                          <Field id="su-email" label="Gmail address" icon={Mail} type="email" autoComplete="email" required maxLength={120}
                            value={suForm.email} onChange={setSu("email")} placeholder="juan.delacruz@gmail.com" hint="You'll sign in with this." />
                        </div>
                        <div>
                          <p className="block text-[13px] font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Default delivery location</p>
                          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                            Search your barangay, tap <b>Use my location</b>, or drop a pin on your house. Orders go here unless you pick another spot at checkout.
                          </p>
                          <LocationPicker value={suLocation} onChange={(loc) => { setSuLocation(loc); if (loc) setSuError(""); }} />
                        </div>
                      </div>
                    )}

                    {suStep === 2 && (
                      <div className="space-y-5 animate-rise-in">
                        <div className="grid sm:grid-cols-2 gap-5 sm:gap-3">
                          <Field
                            id="su-password" label="Password" icon={Lock} type={suShowPass ? "text" : "password"} autoComplete="new-password" required maxLength={128}
                            value={suForm.password} onChange={setSu("password")} placeholder="Password"
                            trailing={<RevealButton shown={suShowPass} onToggle={() => setSuShowPass(!suShowPass)} />}
                          />
                          <Field
                            id="su-confirm" label="Confirm password" icon={Lock} type={suShowPass ? "text" : "password"} autoComplete="new-password" required maxLength={128}
                            value={suForm.confirm} onChange={setSu("confirm")} placeholder="Type it again"
                          />
                        </div>
                        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs" aria-label="Password rules">
                          {[...PASSWORD_RULES.map((r) => ({ ok: r.test(suForm.password), label: r.label })),
                            { ok: suForm.confirm.length > 0 && suForm.confirm === suForm.password, label: "Both passwords match" }].map((r) => (
                            <li key={r.label} className="flex items-center gap-1.5" style={{ color: r.ok ? "var(--good)" : "var(--text-muted)" }}>
                              {r.ok ? <Check size={13} /> : <Circle size={11} />} {r.label}
                            </li>
                          ))}
                        </ul>
                        <div className="rounded-xl border px-4 py-3 text-xs space-y-1" style={{ borderColor: "var(--border)", background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                          <p className="font-bold uppercase tracking-wide text-[10px]" style={{ color: "var(--text-faint)" }}>Check your details</p>
                          <p><span style={{ color: "var(--text-secondary)" }}>Name:</span> {fullName({ firstName: cleanName(suForm.firstName), middleName: cleanName(suForm.middleName), lastName: cleanName(suForm.lastName), suffix: suForm.suffix })}</p>
                          <p><span style={{ color: "var(--text-secondary)" }}>Mobile:</span> {normalizePhone(suForm.contact)} · <span style={{ color: "var(--text-secondary)" }}>Email:</span> {normalizeEmail(suForm.email)}</p>
                          <p className="line-clamp-2"><span style={{ color: "var(--text-secondary)" }}>Delivery location:</span> {suLocation?.address}</p>
                        </div>
                      </div>
                    )}

                    {suError && <Notice tone="bad">{suError}</Notice>}

                    <div className="flex gap-3">
                      {suStep > 0 && (
                        <button type="button" onClick={() => { setSuError(""); setSuStep((n) => n - 1); }}
                          className={`h-12 px-5 rounded-xl border text-sm font-bold inline-flex items-center gap-1.5 transition hover:bg-[color:var(--bg-muted)] ${FOCUS_RING}`}
                          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                          <ArrowLeft size={16} /> Back
                        </button>
                      )}
                      <button type="submit" disabled={suLoading} className={PRIMARY_BUTTON} style={PRIMARY_BUTTON_STYLE}>
                        {suStep < 2
                          ? <>Next: {SIGNUP_STEPS[suStep + 1]} <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" /></>
                          : suLoading ? "Sending registration..." : <>Create account <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" /></>}
                      </button>
                    </div>
                  </form>
                  )}

                  <p className="mt-4 flex items-center justify-center gap-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
                    <ShieldCheck size={13} /> Staff and driver accounts are set up by the store admin.
                  </p>

                  <div className="mt-7 pt-6 border-t text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signin")}
                      className={`group inline-flex items-center gap-1 font-bold rounded ${FOCUS_RING}`}
                      style={{ color: "var(--brand)" }}
                    >
                      Sign in <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </main>
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
