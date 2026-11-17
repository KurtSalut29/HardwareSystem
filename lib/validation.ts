/**
 * Rules for the details people type in: names, mobile numbers, email, passwords.
 * Shared by the forms (instant feedback) and the API (the rule that counts), so
 * the two never disagree.
 */

/** Philippine mobile number, stored as 11 digits: 09XXXXXXXXX. */
export const PH_MOBILE_RE = /^09\d{9}$/;

/** "0917 123 4567", "0917-123-4567" and "+63 917 123 4567" all become "09171234567"; anything else is null. */
export function normalizePhone(input: unknown): string | null {
  const raw = String(input ?? "").replace(/[\s()-]/g, "");
  const local = raw.startsWith("+63") ? `0${raw.slice(3)}` : raw.startsWith("63") && raw.length === 12 ? `0${raw.slice(2)}` : raw;
  return PH_MOBILE_RE.test(local) ? local : null;
}

export const PHONE_HINT = "11 digits starting with 09, e.g. 0917 123 4567";

/**
 * For mobile-number inputs, applied on every keystroke: numbers only, and no
 * more than 11 digits (or "+63" and 10 digits), so a longer number can't be typed.
 */
export function limitPhoneInput(value: string): string {
  const t = value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return t.startsWith("+") ? t.slice(0, 13) : t.slice(0, 11);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(input: unknown): string | null {
  const e = String(input ?? "").trim().toLowerCase();
  return e.length <= 120 && EMAIL_RE.test(e) ? e : null;
}

/** Letters (Ñ and accents too), spaces, hyphens, apostrophes and periods: "Ma. Cristina", "Dela Cruz", "O'Neil". */
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]*$/;

export function cleanName(input: unknown): string {
  return String(input ?? "").trim().replace(/\s+/g, " ");
}

export function nameProblem(value: string, label: string, required: boolean): string | null {
  if (!value) return required ? `Enter your ${label}.` : null;
  if (value.length > 50) return `Your ${label} is too long (50 characters at most).`;
  if (!NAME_RE.test(value)) return `Your ${label} can only have letters, spaces, hyphens, periods and apostrophes.`;
  return null;
}

export const SUFFIXES = ["Jr.", "Sr.", "II", "III", "IV", "V"] as const;

export type PersonName = { firstName: string; middleName?: string | null; lastName: string; suffix?: string | null };

/** "Juan P. Dela Cruz Jr.": how a customer is shown across the system. */
export function fullName(n: PersonName): string {
  const middle = n.middleName?.trim();
  return [n.firstName, middle ? `${middle.charAt(0).toUpperCase()}.` : null, n.lastName, n.suffix || null]
    .filter(Boolean)
    .join(" ");
}

export const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { test: (p: string) => /[A-Za-z]/.test(p), label: "A letter" },
  { test: (p: string) => /\d/.test(p), label: "A number" },
] as const;

export function passwordProblem(p: string): string | null {
  if (p.length > 128) return "Password is too long (128 characters at most).";
  const missing = PASSWORD_RULES.filter((r) => !r.test(p));
  if (missing.length === 0) return null;
  return `Password needs ${missing.map((r) => r.label.toLowerCase()).join(", ")}.`;
}
