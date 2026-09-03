// Single source of truth for how the business is named in the UI.
// The client's brand is "RM Hardware" (the RM is carried by the logo mark) —
// not "RM Hardware Store", and not the old generic "HardwareStore".
export const STORE_NAME = "RM Hardware";
export const STORE_TAGLINE = "Building materials & hardware supply";

// Earlier versions seeded the store_name setting with the generic default, and
// that value got written back whenever the admin saved the store's map pin. Any
// stored name that is really just that old placeholder is treated as unset so
// the real brand shows through — this fixes existing databases without needing
// a manual edit, while a name the admin deliberately types still wins.
const LEGACY_STORE_NAMES = new Set(["hardware store", "hardwarestore"]);

export function resolveStoreName(stored?: string | null): string {
  const value = (stored ?? "").trim();
  if (!value || LEGACY_STORE_NAMES.has(value.toLowerCase())) return STORE_NAME;
  return value;
}
