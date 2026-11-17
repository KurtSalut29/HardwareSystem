"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Mail, Phone, UserRound } from "lucide-react";
import SettingsCard from "@/components/settings/SettingsCard";
import SettingRow from "@/components/ui/SettingRow";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import Switch from "@/components/ui/Switch";
import { useToast } from "@/components/ui/ToastProvider";
import { limitPhoneInput, PASSWORD_RULES } from "@/lib/validation";
import { roleLabel } from "@/lib/roles";

type Me = {
  username: string; role: string; email: string | null; contact: string | null;
  firstName: string | null; middleName: string | null; lastName: string | null; suffix: string | null;
  emailUpdates: boolean; createdAt: string;
};

const FIELD = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-4 shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

/** Your own details and password. Everyone has this section. */
export default function AccountSection() {
  const showToast = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/account").then(async (r) => {
      if (!live) return;
      if (!r.ok) { setLoadError(true); return; }
      const d: Me = await r.json();
      setMe(d); setEmail(d.email ?? ""); setContact(d.contact ?? "");
    }).catch(() => { if (live) setLoadError(true); });
    return () => { live = false; };
  }, []);

  const dirty = !!me && (email.trim() !== (me.email ?? "") || contact !== (me.contact ?? ""));
  const isCustomer = me?.role === "customer";

  async function save() {
    if (!me) return;
    setError(""); setSaving(true);
    const res = await fetch("/api/account", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), contact }),
    });
    setSaving(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Couldn't save your details. Try again."); showToast(d.error ?? "Couldn't save your details.", "error"); return; }
    setMe(d); setEmail(d.email ?? ""); setContact(d.contact ?? "");
    showToast("Your details are saved.");
  }

  async function setEmailUpdates(on: boolean) {
    if (!me) return;
    setMe({ ...me, emailUpdates: on });
    const res = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailUpdates: on }) });
    if (!res.ok) { setMe({ ...me }); showToast("Couldn't change your email preference. Try again.", "error"); return; }
    showToast(on ? "You'll get payment and refund emails." : "Payment and refund emails are off. You'll still see them in the app.", "info");
  }

  const fullName = me && [me.firstName, me.middleName, me.lastName, me.suffix].filter(Boolean).join(" ");

  return (
    <div className="space-y-5">
      <SettingsCard title="Your details" icon={<UserRound className="size-5" />}
        description="How the store and drivers reach you."
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {dirty && <span className="mr-auto text-[12px] font-semibold text-warn">You have unsaved changes.</span>}
            <Button variant="secondary" disabled={!dirty || saving} onClick={() => { setEmail(me?.email ?? ""); setContact(me?.contact ?? ""); setError(""); }}>Discard</Button>
            <Button onClick={save} loading={saving} disabled={!dirty}>Save details</Button>
          </div>
        }>
        {loadError && <div className="py-3"><Alert tone="bad" compact>Couldn&apos;t load your details. Refresh the page to try again.</Alert></div>}
        {!me && !loadError && <div className="my-4 h-24 animate-pulse rounded-xl bg-recess" />}
        {me && (
          <>
            <SettingRow wide id="acct-name" label="Name" hint={isCustomer ? "To correct your name, ask the store — it was checked when your account was approved." : `Signs in as ${me.username}.`}
              status={<p id="acct-name" className="truncate text-[13.5px] font-semibold text-ink">{fullName || me.username}</p>}>
              <span className="rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-ink-3 ring-1 ring-line">
                {roleLabel(me.role)} · since {new Date(me.createdAt).toLocaleDateString("en-PH", { month: "short", year: "numeric" })}
              </span>
            </SettingRow>
            <SettingRow wide id="acct-email" label="Email" hint={isCustomer ? "You sign in with this, and receipts and updates go here." : "Optional. Lets you sign in with your email too."}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
                <input id="acct-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120}
                  className={`${FIELD} pl-9`} placeholder="name@gmail.com" />
              </div>
            </SettingRow>
            <SettingRow wide id="acct-contact" label="Mobile number" hint={isCustomer ? "Drivers call this when they arrive. 11 digits, starts with 09." : "11 digits, starts with 09."}>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
                <input id="acct-contact" inputMode="numeric" value={contact} onChange={(e) => setContact(limitPhoneInput(e.target.value))} maxLength={13}
                  className={`${FIELD} num pl-9`} placeholder="09171234567" />
              </div>
            </SettingRow>
            {isCustomer && (
              <SettingRow wide id="acct-mail" label="Payment and refund emails" hint="When the store approves or rejects a payment, sends a refund, or reminds you of a balance. They always show in the app's bell too."
                tone={me.emailUpdates ? "good" : "neutral"}
                status={me.emailUpdates
                  ? <span><b className="text-good">On</b> <span className="text-ink-4">· sent to {me.email || "your email"}</span></span>
                  : <span><b className="text-ink-3">Off</b> <span className="text-ink-4">· you&apos;ll only see them in the app</span></span>}>
                <Switch id="acct-mail" checked={me.emailUpdates} onChange={setEmailUpdates} label="Payment and refund emails" />
              </SettingRow>
            )}
            {error && <div className="pb-3"><Alert tone="bad" compact>{error}</Alert></div>}
          </>
        )}
      </SettingsCard>

      <PasswordCard />
    </div>
  );
}

function PasswordCard() {
  const showToast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const rules = PASSWORD_RULES.map((r) => ({ label: r.label, ok: r.test(next) }));
  const mismatch = confirm !== "" && confirm !== next;
  const ready = current && rules.every((r) => r.ok) && next === confirm;

  async function save() {
    setError(""); setSaving(true);
    const res = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current, next }) });
    setSaving(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Couldn't change your password."); return; }
    setCurrent(""); setNext(""); setConfirm("");
    showToast("Password changed. Use the new one next time you sign in.");
  }

  const input = (id: string, value: string, set: (v: string) => void, placeholder: string, auto: string) => (
    <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => set(e.target.value)} autoComplete={auto} maxLength={128}
      className={FIELD} placeholder={placeholder} />
  );

  return (
    <SettingsCard title="Password" icon={<KeyRound className="size-5" />}
      description="Use at least 8 characters with a letter and a number. You stay signed in on this device after changing it."
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={() => setShow((s) => !s)} className="mr-auto inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-3 hover:text-ink">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {show ? "Hide passwords" : "Show passwords"}
          </button>
          <Button onClick={save} loading={saving} disabled={!ready}>Change password</Button>
        </div>
      }>
      <SettingRow wide id="pw-current" label="Current password">{input("pw-current", current, setCurrent, "Current password", "current-password")}</SettingRow>
      <SettingRow wide id="pw-next" label="New password" hint={
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {rules.map((r) => <span key={r.label} className={next ? (r.ok ? "text-good" : "text-bad") : ""}>{r.ok && next ? "✓" : "•"} {r.label}</span>)}
        </span>
      }>{input("pw-next", next, setNext, "New password", "new-password")}</SettingRow>
      <SettingRow wide id="pw-confirm" label="Type it again" hint={mismatch ? <span className="text-bad">The two new passwords don&apos;t match.</span> : undefined}>
        {input("pw-confirm", confirm, setConfirm, "New password again", "new-password")}
      </SettingRow>
      {error && <div className="pb-3"><Alert tone="bad" compact>{error}</Alert></div>}
    </SettingsCard>
  );
}
