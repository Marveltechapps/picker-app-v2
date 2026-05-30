import createContextHook from "@nkzw/create-context-hook";
import { useState } from "react";

export type LanguageCode = "en";

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
}

/** English only - single supported language. */
export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English" },
];

interface LanguageState {
  currentLanguage: LanguageCode;
  isLoading: boolean;
}

export const [LanguageProvider, useLanguage] = createContextHook(() => {
  const [state] = useState<LanguageState>({
    currentLanguage: "en",
    isLoading: false,
  });

  const getCurrentLanguage = (): Language => SUPPORTED_LANGUAGES[0];

  return {
    ...state,
    setLanguage: async () => {},
    getCurrentLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
});
