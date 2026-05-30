import { apiGet } from "@/utils/apiClient";

interface ApiDataResponse<T> {
  success: boolean;
  data: T;
}

export interface ProfileDocumentSide {
  url: string | null;
  status: "not_uploaded" | "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  reviewedAt: string | null;
  uploadedAt: string | null;
  updatedAt: string | null;
}

export interface ProfileDocumentDetail {
  docType: "aadhar" | "pan";
  status: "not_uploaded" | "partial" | "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  reviewedAt: string | null;
  sides: {
    front: ProfileDocumentSide;
    back: ProfileDocumentSide;
  };
}

export interface ProfileOverviewData {
  picker: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    photoUri: string | null;
    joinedAt: string | null;
    status: string | null;
    role: string | null;
    locationType: string | null;
  };
  documents: {
    requiredCount: number;
    uploadedCount: number;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
    partialCount: number;
    fullyUploaded: boolean;
  };
  documentDetails: {
    aadhar: ProfileDocumentDetail;
    pan: ProfileDocumentDetail;
  };
  bank: {
    hasAnyAccount: boolean;
    hasVerifiedAccount: boolean;
    defaultAccountId: string | null;
    defaultAccountMasked: string | null;
    defaultBankName: string | null;
    upiId: string | null;
    upiName: string | null;
  };
  training: {
    totalVideos: number;
    completedVideos: number;
    progressPercent: number;
    completed: boolean;
  };
  device: {
    assigned: boolean;
    deviceId: string | null;
    serial: string | null;
    status: string | null;
    assignedAt: string | null;
  };
  support: {
    openTicketsCount: number;
  };
  notifications: {
    unreadCount: number;
  };
}

export async function getProfileOverviewApi(): Promise<ProfileOverviewData> {
  const response = await apiGet<ApiDataResponse<ProfileOverviewData>>("/users/profile/overview");
  return (response as ApiDataResponse<ProfileOverviewData>).data;
}
