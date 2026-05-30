import { ApiClientError, apiGet } from '@/utils/apiClient';

export interface LegalDocument {
  id: string;
  version: string;
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  contentFormat: 'plain' | 'html' | 'markdown';
  content: string;
}

export interface LegalConfig {
  preamble: string;
  terms: { label: string; type: 'in_app' | 'url'; url: string | null };
  privacy: { label: string; type: 'in_app' | 'url'; url: string | null };
  connector: string;
}

interface LegalDocResponse {
  success: boolean;
  data: LegalDocument;
}

interface LegalConfigResponse {
  success: boolean;
  data: { loginLegal: LegalConfig };
}

const TERMS_FALLBACK: LegalDocument = {
  id: 'fallback-terms',
  version: 'fallback',
  title: 'Terms & Conditions',
  effectiveDate: '',
  lastUpdated: '',
  contentFormat: 'plain',
  content:
    'By accessing and using this Picker application, you agree to use it only for authorized work-related purposes and to follow all warehouse and safety policies.',
};

const PRIVACY_FALLBACK: LegalDocument = {
  id: 'fallback-privacy',
  version: 'fallback',
  title: 'Privacy Policy',
  effectiveDate: '',
  lastUpdated: '',
  contentFormat: 'plain',
  content:
    'We collect only the personal and operational information required to provide service, process attendance, and meet compliance requirements. We do not sell personal information.',
};

function normalizeLegalDocument(
  doc: LegalDocument | undefined,
  fallback: LegalDocument
): LegalDocument {
  if (!doc || typeof doc.content !== 'string' || doc.content.trim().length === 0) {
    return fallback;
  }

  return {
    ...fallback,
    ...doc,
    content: doc.content.trim(),
  };
}

async function fetchLegalDocument(
  endpoint: '/legal/terms' | '/legal/privacy',
  fallback: LegalDocument
): Promise<LegalDocument> {
  try {
    const res = await apiGet<LegalDocResponse>(endpoint);
    return normalizeLegalDocument(res?.data, fallback);
  } catch (error) {
    const isNotFound =
      error instanceof ApiClientError &&
      (error.status === 404 || /not found/i.test(error.message));

    if (isNotFound) return fallback;
    throw error;
  }
}

export async function fetchPickerTerms(): Promise<LegalDocument> {
  return fetchLegalDocument('/legal/terms', TERMS_FALLBACK);
}

export async function fetchPickerPrivacy(): Promise<LegalDocument> {
  return fetchLegalDocument('/legal/privacy', PRIVACY_FALLBACK);
}

export async function fetchLegalConfig(): Promise<LegalConfig> {
  const res = await apiGet<LegalConfigResponse>('/legal/config');
  return res.data.loginLegal;
}
