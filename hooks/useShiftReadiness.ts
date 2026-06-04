import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";
import { getProfileOverviewApi } from "@/services/profileOverview.service";
import { getProfileApi } from "@/services/user.service";
import { getShiftReadinessApi } from "@/services/shifts.service";
import { useAuth } from "@/state/authContext";
import {
  getShiftReadiness,
  type ShiftReadiness,
} from "@/utils/shiftReadiness";

const defaultReadiness: ShiftReadiness = {
  deviceAssigned: false,
  personalInformationComplete: false,
  bankAccountComplete: false,
  trainingComplete: false,
  documentVerificationComplete: false,
  canStartShift: false,
};

export function useShiftReadiness() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();

  const overviewQuery = useQuery({
    queryKey: ["profile", "overview"],
    queryFn: getProfileOverviewApi,
    staleTime: 0,
  });

  const profileQuery = useQuery({
    queryKey: ["profile", "detail"],
    queryFn: getProfileApi,
    staleTime: 0,
  });

  const readinessQuery = useQuery({
    queryKey: ["shifts", "readiness"],
    queryFn: getShiftReadinessApi,
    staleTime: 0,
  });

  const refetchAll = useCallback(() => {
    void Promise.all([
      overviewQuery.refetch(),
      profileQuery.refetch(),
      readinessQuery.refetch(),
    ]);
  }, [overviewQuery, profileQuery, readinessQuery]);

  useFocusEffect(
    useCallback(() => {
      refetchAll();
    }, [refetchAll])
  );

  const readiness = useMemo(() => {
    const profile = profileQuery.data ?? userProfile ?? null;
    if (overviewQuery.data) {
      return getShiftReadiness(overviewQuery.data, profile);
    }
    if (readinessQuery.data) return readinessQuery.data;
    return defaultReadiness;
  }, [overviewQuery.data, profileQuery.data, readinessQuery.data, userProfile]);

  const hasReadinessSource = !!overviewQuery.data || !!readinessQuery.data;
  const isLoading =
    !hasReadinessSource &&
    (overviewQuery.isLoading || profileQuery.isLoading || readinessQuery.isLoading);

  const invalidateReadiness = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["profile", "overview"] });
    void queryClient.invalidateQueries({ queryKey: ["profile", "detail"] });
    void queryClient.invalidateQueries({ queryKey: ["shifts", "readiness"] });
  }, [queryClient]);

  return {
    readiness,
    isLoading,
    refetch: refetchAll,
    invalidateReadiness,
  };
}
