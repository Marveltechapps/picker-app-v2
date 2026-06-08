import type { LoginMode } from "@/services/auth.service";

/** True for standard 10-digit Indian mobiles (excludes email-login synthetic phones). */
export function isRealIndianPhone(phone: string | null | undefined): boolean {
  const digits = (phone ?? "").replace(/\D/g, "");
  const normalized = digits.length >= 10 ? digits.slice(-10) : digits;
  return /^[5-9]\d{9}$/.test(normalized);
}

export function normalizeIndianPhoneDigits(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function formatIndianPhone(phone: string | null | undefined, countryCode = "+91"): string {
  const digits = normalizeIndianPhoneDigits(phone);
  if (!isRealIndianPhone(digits)) return "—";
  return `${countryCode} ${digits}`;
}

export interface ContactInfoCard {
  key: string;
  label: string;
  value: string;
}

export function buildLoginContactCards(params: {
  loginMethod?: LoginMode | null;
  phone?: string | null;
  email?: string | null;
  countryCode?: string;
}): ContactInfoCard[] {
  const method = params.loginMethod ?? null;
  const countryCode = params.countryCode ?? "+91";
  const email = (params.email ?? "").trim();
  const phoneFormatted = formatIndianPhone(params.phone, countryCode);
  const hasRealPhone = isRealIndianPhone(params.phone);

  const cards: ContactInfoCard[] = [];

  if (method === "email") {
    cards.push({
      key: "email",
      label: "Email",
      value: email || "—",
    });
    if (hasRealPhone) {
      cards.push({
        key: "phone",
        label: "Mobile Number",
        value: phoneFormatted,
      });
    }
    return cards;
  }

  if (method === "whatsapp") {
    cards.push({
      key: "whatsapp",
      label: "WhatsApp Number",
      value: hasRealPhone ? phoneFormatted : "—",
    });
    if (email) {
      cards.push({ key: "email", label: "Email", value: email });
    }
    return cards;
  }

  // mobile (default)
  cards.push({
    key: "mobile",
    label: "Mobile Number",
    value: hasRealPhone ? phoneFormatted : "—",
  });
  if (email) {
    cards.push({ key: "email", label: "Email", value: email });
  }
  return cards;
}

export function getProfileContactSubtitle(params: {
  loginMethod?: LoginMode | null;
  phone?: string | null;
  email?: string | null;
  countryCode?: string;
}): string {
  const cards = buildLoginContactCards(params);
  const primary = cards[0]?.value;
  if (primary && primary !== "—") return primary;
  const secondary = cards[1]?.value;
  if (secondary && secondary !== "—") return secondary;
  return "No contact details";
}

/** Single line under the user name (mobile, WhatsApp, or email used to log in). */
export function getLoginContactLine(params: {
  loginMethod?: LoginMode | null;
  phone?: string | null;
  email?: string | null;
  countryCode?: string;
}): string | null {
  const line = getProfileContactSubtitle(params);
  if (!line || line === "—" || line === "No contact details") return null;
  return line;
}
