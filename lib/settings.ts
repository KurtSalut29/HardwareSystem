import { prisma } from "@/lib/prisma";
import { resolveStoreName } from "@/lib/brand";
import { SETTING_DEFS, SETTING_IDS, decodeSetting, defaultSettings, encodeSetting, type AppSettings, type SettingId } from "@/lib/settings-schema";

/** Server-side: every store setting, with defaults for anything never saved. */
export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: SETTING_IDS.map((id) => SETTING_DEFS[id].key) } } });
  const out = defaultSettings() as Record<SettingId, unknown>;
  for (const id of SETTING_IDS) {
    const row = rows.find((r) => r.key === SETTING_DEFS[id].key);
    out[id] = decodeSetting(id, row?.value);
  }
  const s = out as AppSettings;
  s.storeName = resolveStoreName(s.storeName);
  return s;
}

/** Only the settings customers and staff may see (no admin-only switches). */
export function publicView(s: AppSettings): Partial<AppSettings> {
  const out: Partial<Record<SettingId, unknown>> = {};
  for (const id of SETTING_IDS) if ((SETTING_DEFS[id] as { public?: boolean }).public) out[id] = s[id];
  return out as Partial<AppSettings>;
}

/** Validates a partial update from the admin form; nothing is saved if any value is wrong. */
export function parseSettingsUpdate(input: Record<string, unknown>): { error: string } | { rows: { key: string; value: string }[] } {
  const rows: { key: string; value: string }[] = [];
  for (const [id, value] of Object.entries(input)) {
    if (!(id in SETTING_DEFS)) continue;
    const res = encodeSetting(id as SettingId, value);
    if ("error" in res) return { error: res.error };
    rows.push({ key: SETTING_DEFS[id as SettingId].key, value: res.value });
  }
  return { rows };
}

export async function saveSettings(rows: { key: string; value: string }[]) {
  await prisma.$transaction(rows.map((r) => prisma.setting.upsert({ where: { key: r.key }, update: { value: r.value }, create: r })));
}
