import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";

countries.registerLocale(en);

export interface CountryOption {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

function flagEmoji(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return "🏳️";
  const points = [...code].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...points);
}

function buildCountryList(): CountryOption[] {
  const callingCountries = getCountries();
  const all: CountryOption[] = [];
  for (const code of callingCountries) {
    try {
      const dialCode = `+${getCountryCallingCode(code)}`;
      const name = countries.getName(code, "en") ?? code;
      all.push({ code: String(code), name, dialCode, flag: flagEmoji(code) });
    } catch {
      /* skip invalid country */
    }
  }

  const priority = ["ZA", "IN", "US", "GB"];
  const prioritySet = new Set(priority);
  const prioritized = priority
    .map((code) => all.find((c) => c.code === code))
    .filter((c): c is CountryOption => !!c);
  const rest = all
    .filter((c) => !prioritySet.has(c.code))
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...prioritized, ...rest];
}

export const COUNTRY_LIST: CountryOption[] = buildCountryList();

export const DEFAULT_COUNTRY_CODE = "IN";

export function findCountryByCode(code: string): CountryOption | undefined {
  return COUNTRY_LIST.find((c) => c.code === code);
}

export function findCountryByDialCode(dialCode: string): CountryOption | undefined {
  const normalized = dialCode.startsWith("+") ? dialCode : `+${dialCode}`;
  return COUNTRY_LIST.find((c) => c.dialCode === normalized);
}
