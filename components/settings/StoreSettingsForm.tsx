"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Trash2 } from "lucide-react";
import SettingsCard from "@/components/settings/SettingsCard";
import SettingRow, { UnitInput } from "@/components/ui/SettingRow";
import Switch from "@/components/ui/Switch";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { useToast } from "@/components/ui/ToastProvider";
import { refreshSettings, useSettings } from "@/lib/useSettings";
import { SETTING_DEFS, SETTING_IDS, type SettingDef, type SettingGroup, type SettingId } from "@/lib/settings-schema";
import { limitPhoneInput } from "@/lib/validation";

const FIELD = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-4 shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

type Draft = Partial<Record<SettingId, string | boolean>>;

/**
 * The admin's form for one group of store settings (Payments, GCash, …), built
 * from lib/settings-schema. Saves only what changed; everyone sees the new
 * values right away.
 */
export default function StoreSettingsForm({ group, title, description, icon, notice, savedMessage }: {
  group: SettingGroup;
  title: string;
  description: string;
  icon: React.ReactNode;
  /** A note shown above the fields: what these settings change for people. */
  notice?: React.ReactNode;
  savedMessage: string;
}) {
  const settings = useSettings();
  const showToast = useToast();
  const ids = SETTING_IDS.filter((id) => SETTING_DEFS[id].group === group);
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const valueOf = (id: SettingId): string | boolean => {
    if (id in draft) return draft[id] as string | boolean;
    const v = settings[id];
    return typeof v === "boolean" ? v : String(v);
  };
  const changed = ids.filter((id) => id in draft && String(draft[id]) !== String(settings[id]));
  const dirty = changed.length > 0;

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    setError(""); setSaving(true);
    const body: Record<string, unknown> = {};
    for (const id of changed) {
      const def = SETTING_DEFS[id] as SettingDef;
      body[id] = def.type === "boolean" ? draft[id] : def.type === "number" ? Number(draft[id]) : draft[id];
    }
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Couldn't save the settings. Try again."); showToast(d.error ?? "Couldn't save the settings.", "error"); return; }
    await refreshSettings();
    setDraft({});
    showToast(savedMessage);
  }

  const set = (id: SettingId, v: string | boolean) => setDraft((d) => ({ ...d, [id]: v }));

  return (
    <SettingsCard title={title} description={description} icon={icon}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirty
            ? <span className="mr-auto text-[12px] font-semibold text-warn">{changed.length} unsaved {changed.length === 1 ? "change" : "changes"}</span>
            : <span className="mr-auto text-[12px] text-ink-4">Changes apply right away for everyone.</span>}
          <Button variant="secondary" disabled={!dirty || saving} onClick={() => { setDraft({}); setError(""); }}>Discard</Button>
          <Button onClick={save} loading={saving} disabled={!dirty || !settings.loaded}>Save changes</Button>
        </div>
      }>
      {notice && <div className="pt-4">{notice}</div>}
      {!settings.loaded && <div className="my-4 h-32 animate-pulse rounded-xl bg-recess" />}
      {settings.loaded && ids.map((id) => {
        const def = SETTING_DEFS[id] as SettingDef;
        const v = valueOf(id);
        const fid = `set-${id}`;
        // The fee's unit follows the fee type chosen just above it.
        const feeIsFixed = id === "cancelFeeValue" && String(valueOf("cancelFeeType")) === "fixed";
        return (
          <SettingRow key={id} id={fid} label={def.label} hint={def.hint}>
            {def.type === "boolean" ? (
              <div className="flex items-center gap-2">
                <Switch id={fid} checked={v === true} onChange={(on) => set(id, on)} label={def.label} />
                <span className={`text-[12.5px] font-semibold ${v === true ? "text-good" : "text-ink-4"}`}>{v === true ? "On" : "Off"}</span>
              </div>
            ) : def.type === "number" ? (
              <UnitInput id={fid} type="number" inputMode="decimal" min={def.min} max={def.max} step={def.whole ? 1 : "any"}
                value={String(v)} onChange={(e) => set(id, e.target.value)}
                prefix={id === "cancelFeeValue" ? (feeIsFixed ? "₱" : undefined) : def.prefix}
                suffix={id === "cancelFeeValue" ? (feeIsFixed ? undefined : "%") : def.suffix} />
            ) : def.type === "choice" ? (
              <select id={fid} value={String(v)} onChange={(e) => set(id, e.target.value)} className={FIELD}>
                {def.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : def.type === "phone" ? (
              <input id={fid} inputMode="numeric" value={String(v)} onChange={(e) => set(id, limitPhoneInput(e.target.value))} maxLength={13}
                className={`${FIELD} num`} placeholder="09171234567" />
            ) : def.type === "image" ? (
              <ImageField id={fid} value={String(v)} onChange={(url) => set(id, url)} />
            ) : def.multiline ? (
              <textarea id={fid} value={String(v)} onChange={(e) => set(id, e.target.value)} maxLength={def.max} rows={5}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" />
            ) : (
              <input id={fid} value={String(v)} onChange={(e) => set(id, e.target.value)} maxLength={def.max} className={FIELD} placeholder={def.placeholder} />
            )}
          </SettingRow>
        );
      })}
      {error && <div className="pb-3"><Alert tone="bad" compact>{error}</Alert></div>}
    </SettingsCard>
  );
}

/** Upload, replace or remove an image setting (the GCash QR). */
function ImageField({ id, value, onChange }: { id: string; value: string; onChange: (url: string) => void }) {
  const showToast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Choose an image (JPG, PNG or WebP).", "error"); return; }
    if (file.size > 2 * 1024 * 1024) { showToast("That image is over 2 MB. Use a smaller screenshot.", "error"); return; }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.url) { showToast(d.error ?? "Couldn't upload the image.", "error"); return; }
    onChange(d.url);
    showToast("Image ready. Click Save changes to use it.", "info");
  }

  return (
    <div className="flex items-center gap-3">
      <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-subtle">
        {value ? <Image src={value} alt="Current image" width={80} height={80} className="size-20 object-contain" unoptimized /> : <span className="text-[11px] text-ink-4">None</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <input ref={input} id={id} type="file" accept="image/*" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        <Button size="sm" variant="secondary" loading={busy} icon={<ImagePlus className="size-3.5" />} onClick={() => input.current?.click()}>{value ? "Replace" : "Upload"}</Button>
        {value && <Button size="sm" variant="danger-soft" icon={<Trash2 className="size-3.5" />} onClick={() => onChange("")}>Remove</Button>}
      </div>
    </div>
  );
}
