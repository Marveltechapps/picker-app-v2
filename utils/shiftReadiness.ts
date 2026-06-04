import type { ProfileOverviewData } from "@/services/profileOverview.service";
import type { UserProfileApiData } from "@/services/user.service";

export interface ShiftReadiness {
  deviceAssigned: boolean;
  personalInformationComplete: boolean;
  bankAccountComplete: boolean;
  trainingComplete: boolean;
  documentVerificationComplete: boolean;
  canStartShift: boolean;
}

/** Align with Profile / device-status: HHD active session or dashboard assignment counts as assigned. */
function isDeviceAssigned(device: ProfileOverviewData["device"]): boolean {
  const hhdActive = device.inUseOnHhd === true || device.hhdActive === true;
  if (hhdActive) return true;
  if (!device.assigned) return false;
  const status = (device.status ?? "").trim().toUpperCase();
  return status === "ASSIGNED" || !!device.deviceId;
}

function isPersonalInformationComplete(
  overview: ProfileOverviewData,
  profile: UserProfileApiData | null | undefined
): boolean {
  const name = (overview.picker.name ?? profile?.name ?? "").trim();
  const email = (overview.picker.email ?? profile?.email ?? "").trim();
  const phone = (overview.picker.phone ?? profile?.phone ?? "").trim();
  const photoUri = (overview.picker.photoUri ?? profile?.photoUri ?? "").trim();
  const age = profile?.age;
  const gender = profile?.gender;

  return (
    name.length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    phone.replace(/\D/g, "").length >= 10 &&
    !!photoUri &&
    age != null &&
    age >= 1 &&
    !!gender
  );
}

function isBankAccountComplete(bank: ProfileOverviewData["bank"]): boolean {
  return bank.hasAnyAccount || !!bank.upiId;
}

function isTrainingComplete(training: ProfileOverviewData["training"]): boolean {
  if (training.trainingCompleted === true) return true;
  return training.completed;
}

function isDocumentVerificationComplete(documents: ProfileOverviewData["documents"]): boolean {
  const required = documents.requiredCount ?? 0;
  if (required <= 0) return false;
  return documents.approvedCount === required;
}

export function getShiftReadiness(
  overview: ProfileOverviewData,
  profile?: UserProfileApiData | null
): ShiftReadiness {
  const deviceAssigned = isDeviceAssigned(overview.device);
  const personalInformationComplete = isPersonalInformationComplete(overview, profile);
  const bankAccountComplete = isBankAccountComplete(overview.bank);
  const trainingComplete = isTrainingComplete(overview.training);
  const documentVerificationComplete = isDocumentVerificationComplete(overview.documents);

  return {
    deviceAssigned,
    personalInformationComplete,
    bankAccountComplete,
    trainingComplete,
    documentVerificationComplete,
    canStartShift:
      deviceAssigned &&
      personalInformationComplete &&
      bankAccountComplete &&
      trainingComplete &&
      documentVerificationComplete,
  };
}

export function getShiftReadinessMessage(readiness: ShiftReadiness): string {
  const missing: string[] = [];
  if (!readiness.deviceAssigned) missing.push("Device status must be Assigned");
  if (!readiness.personalInformationComplete) missing.push("Complete Personal Information");
  if (!readiness.bankAccountComplete) missing.push("Complete Bank Account details");
  if (!readiness.trainingComplete) missing.push("Complete Training");
  if (!readiness.documentVerificationComplete) missing.push("Complete Document Verification");
  if (missing.length === 0) return "";
  return `Complete the following before starting your shift:\n\n${missing.map((m) => `• ${m}`).join("\n")}`;
}
