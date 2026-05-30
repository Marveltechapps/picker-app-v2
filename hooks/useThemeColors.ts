import { useMemo } from "react";
import { getThemeColors } from "@/constants/theme";

/** Returns light theme colors only. */
export const useThemeColors = () => useMemo(() => getThemeColors("light"), []);
