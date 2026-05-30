import { useMemo } from "react";
import enTranslations from "@/locales/en.json";

type TranslationKey = string;
type TranslationObject = Record<string, unknown>;

/** English only. All UI text uses en.json. */
export const useTranslation = (_language?: string) => {
  const t = useMemo(
    () => (key: TranslationKey): string => {
      const keys = key.split(".");
      let value: unknown = enTranslations as TranslationObject;

      for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
          value = (value as Record<string, unknown>)[k];
        } else {
          return key;
        }
      }

      if (typeof value === "string") {
        return value;
      }
      return key;
    },
    []
  );

  return { t };
};
