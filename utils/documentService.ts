/**
 * Document Service
 *
 * Handles document upload and fetch per backend-workflow.yaml (documents_upload, documents_list).
 */

import { apiGet, apiPostFormData, ApiClientError } from "@/utils/apiClient";

export interface DocumentUploadResponse {
  success: boolean;
  message?: string;
  documentUrl?: string;
  error?: string;
}

export interface DocumentFetchResponse {
  success: boolean;
  documents?: {
    aadhar?: {
      front?: string | null;
      back?: string | null;
    };
    pan?: {
      front?: string | null;
      back?: string | null;
    };
  };
  details?: {
    aadhar?: {
      docType: "aadhar";
      status: "not_uploaded" | "partial" | "pending" | "approved" | "rejected";
      rejectionReason: string | null;
      reviewedAt: string | null;
      sides: {
        front: DocumentSideDetail;
        back: DocumentSideDetail;
      };
    };
    pan?: {
      docType: "pan";
      status: "not_uploaded" | "partial" | "pending" | "approved" | "rejected";
      rejectionReason: string | null;
      reviewedAt: string | null;
      sides: {
        front: DocumentSideDetail;
        back: DocumentSideDetail;
      };
    };
  };
  summary?: {
    requiredCount: number;
    uploadedCount: number;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
    partialCount: number;
    fullyUploaded: boolean;
  };
  error?: string;
}

export interface DocumentSideDetail {
  url: string | null;
  status: "not_uploaded" | "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  reviewedAt: string | null;
  uploadedAt: string | null;
  updatedAt: string | null;
}

/**
 * Upload a document to the backend
 * POST /documents/upload – multipart docType, side, file
 */
export async function uploadDocument(
  docType: "aadhar" | "pan",
  side: "front" | "back",
  uri: string
): Promise<DocumentUploadResponse> {
  try {
    const formData = new FormData();
    formData.append("docType", docType);
    formData.append("side", side);
    formData.append("file", {
      uri,
      type: "image/jpeg",
      name: `doc-${docType}-${side}.jpg`,
    } as unknown as Blob);
    const response = await apiPostFormData<DocumentUploadResponse>(
      "/documents/upload",
      formData
    );
    return response;
  } catch (error) {
    if (error instanceof ApiClientError) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload document",
    };
  }
}

/**
 * Fetch user documents from the backend
 * GET /documents – returns { success, documents: { aadhar: { front, back }, pan: { front, back } } }
 */
function unwrapDocumentsPayload(raw: unknown): DocumentFetchResponse {
  if (raw && typeof raw === "object" && "data" in raw) {
    const inner = (raw as { data?: DocumentFetchResponse }).data;
    if (inner && typeof inner === "object") return inner;
  }
  return raw as DocumentFetchResponse;
}

export async function fetchDocuments(): Promise<DocumentFetchResponse> {
  try {
    const response = await apiGet<DocumentFetchResponse | { data?: DocumentFetchResponse }>("/documents");
    return unwrapDocumentsPayload(response);
  } catch (error) {
    if (error instanceof ApiClientError) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch documents",
    };
  }
}

/**
 * Update/replace a document
 * @param docType - Type of document ('aadhar' | 'pan')
 * @param side - Side of document ('front' | 'back')
 * @param uri - Local file URI
 * @returns Promise with update response
 */
export async function updateDocument(
  docType: "aadhar" | "pan",
  side: "front" | "back",
  uri: string
): Promise<DocumentUploadResponse> {
  // Update is same as upload for now
  return uploadDocument(docType, side, uri);
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024;
const DEFAULT_MIN_DIMENSION = 200;
const DEFAULT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"];

/**
 * Validate file before upload. Uses config from API when available.
 * @param uri - File URI
 * @param fileSize - File size in bytes
 * @param width - Image width (optional)
 * @param height - Image height (optional)
 * @returns Object with validation result and error message
 */
export async function validateDocumentFile(
  uri: string,
  fileSize?: number,
  width?: number,
  height?: number
): Promise<{ isValid: boolean; error?: string }> {
  let maxSize = DEFAULT_MAX_SIZE;
  let minDimension = DEFAULT_MIN_DIMENSION;
  let validExtensions = DEFAULT_EXTENSIONS;
  try {
    const { getPickerConfig } = await import("@/services/config.service");
    const config = await getPickerConfig();
    if (config.documentMaxSizeBytes) maxSize = config.documentMaxSizeBytes;
    if (config.documentMinDimensionPx) minDimension = config.documentMinDimensionPx;
    if (config.documentAllowedExtensions?.length) validExtensions = config.documentAllowedExtensions;
  } catch {
    // Use defaults
  }

  if (fileSize && fileSize > maxSize) {
    return {
      isValid: false,
      error: `File size exceeds ${Math.round(maxSize / (1024 * 1024))}MB. Please upload a smaller file.`,
    };
  }

  if (width && height) {
    if (width < minDimension || height < minDimension) {
      return {
        isValid: false,
        error: `Image dimensions must be at least ${minDimension}x${minDimension} pixels.`,
      };
    }
  }

  const uriLower = uri.toLowerCase();
  const hasValidExtension = validExtensions.some((ext) => uriLower.endsWith(ext));

  if (!hasValidExtension && uri.includes(".")) {
    return {
      isValid: false,
      error: `Invalid file type. Please upload ${validExtensions.join(", ").replace(/\./g, "").toUpperCase()} files only.`,
    };
  }

  return { isValid: true };
}
