import {
  AsYouType,
  CountryCode,
  getExampleNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";

export function stripDigits(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

export function isAllSameDigit(digits: string): boolean {
  return digits.length > 0 && /^(\d)\1+$/.test(digits);
}

export function getMaxNationalLength(countryCode: string): number {
  try {
    const example = getExampleNumber(countryCode as CountryCode, examples);
    if (example) {
      return example.nationalNumber.length + 5;
    }
  } catch {
    /* ignore */
  }
  return 15;
}

export function getPlaceholder(countryCode: string): string {
  try {
    const example = getExampleNumber(countryCode as CountryCode, examples);
    if (example) {
      return example.formatNational();
    }
  } catch {
    /* ignore */
  }
  return "0000000000";
}

export function formatNationalAsYouType(digits: string, countryCode: string): string {
  if (!digits) return "";
  const formatter = new AsYouType(countryCode as CountryCode);
  return formatter.input(digits);
}

export function getMinNationalLength(countryCode: string): number {
  try {
    const example = getExampleNumber(countryCode as CountryCode, examples);
    if (example) {
      return example.nationalNumber.length;
    }
  } catch {
    /* ignore */
  }
  return 6;
}

export interface PhoneValidationResult {
  valid: boolean;
  message?: string;
  showInvalid: boolean;
}

export function validatePhone(
  nationalDigits: string,
  countryCode: string,
  modeLabel: "mobile" | "whatsapp" = "mobile"
): PhoneValidationResult {
  const digits = stripDigits(nationalDigits);
  const minLen = getMinNationalLength(countryCode);
  const emptyLabel = modeLabel === "whatsapp" ? "Enter WhatsApp number" : "Enter mobile number";

  if (!digits) {
    return { valid: false, message: emptyLabel, showInvalid: false };
  }

  const showInvalid = digits.length >= minLen;

  if (isAllSameDigit(digits)) {
    return { valid: false, message: "Invalid number format", showInvalid };
  }

  try {
    const parsed = parsePhoneNumberFromString(digits, countryCode as CountryCode);
    if (parsed?.isValid()) {
      return { valid: true, showInvalid: false };
    }
    if (showInvalid) {
      return {
        valid: false,
        message: "Invalid number for this country",
        showInvalid: true,
      };
    }
    return { valid: false, showInvalid: false };
  } catch {
    if (showInvalid) {
      return { valid: false, message: "Invalid number format", showInvalid: true };
    }
    return { valid: false, showInvalid: false };
  }
}

export function truncatePhoneForCountry(digits: string, countryCode: string): string {
  const max = getMaxNationalLength(countryCode) - 5;
  return stripDigits(digits).slice(0, max);
}
