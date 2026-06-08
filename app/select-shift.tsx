import { ScrollView } from "@/utils/scrollables";
import { TouchableOpacity } from "@/utils/touchables";
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Sunrise, Sun, Moon, Check } from "lucide-react-native";
import { useAuth, type ShiftSelection } from "@/state/authContext";
import { getAvailableShifts, selectShiftsApi, type ShiftItem } from "@/services/shifts.service";
import { Typography, Spacing, BorderRadius } from "@/constants/theme";
import { useColors } from "@/contexts/ColorsContext";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";
import { appNotify } from "@/utils/appNotify";

const PURPLE = "#121358";

type IconKind = "sunrise" | "sun" | "moon";

interface ShiftOption {
  id: string;
  label: string;
  time: string;
  icon: IconKind;
}

const STATIC_SHIFTS: ShiftOption[] = [
  { id: "morning", label: "Morning", time: "6:00 AM – 2:00 PM", icon: "sunrise" },
  { id: "afternoon", label: "Afternoon", time: "2:00 PM – 10:00 PM", icon: "sun" },
  { id: "night", label: "Night", time: "10:00 PM – 6:00 AM", icon: "moon" },
];

function iconKindFor(id: string, label: string, time: string): IconKind {
  const s = `${id} ${label} ${time}`.toLowerCase();
  if (s.includes("night") || s.includes("10:00 pm")) return "moon";
  if (s.includes("morn") || s.includes("6:00 am")) return "sunrise";
  if (s.includes("after") || s.includes("2:00 pm")) return "sun";
  return "sun";
}

function mapApiShifts(items: ShiftItem[]): ShiftOption[] {
  return items.map((s) => ({
    id: s.id,
    label: s.name || s.id,
    time: s.time || "",
    icon: iconKindFor(s.id, s.name ?? "", s.time ?? ""),
  }));
}

function ShiftGlyph({ kind, color, size }: { kind: IconKind; color: string; size: number }) {
  switch (kind) {
    case "sunrise":
      return <Sunrise color={color} size={size} strokeWidth={2} />;
    case "moon":
      return <Moon color={color} size={size} strokeWidth={2} />;
    default:
      return <Sun color={color} size={size} strokeWidth={2} />;
  }
}

export default function SelectShiftScreen() {
  const router = useRouter();
  const colors = useColors();
  const { setSelectedShifts } = useAuth();
  const [available, setAvailable] = useState<ShiftOption[]>(STATIC_SHIFTS);
  const [selectedShifts, setSelectedIds] = useState<string[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAvailableShifts()
      .then((list) => {
        if (cancelled) return;
        if (list && list.length > 0) {
          setAvailable(mapApiShifts(list));
        } else {
          setAvailable(STATIC_SHIFTS);
        }
      })
      .catch(() => {
        if (!cancelled) setAvailable(STATIC_SHIFTS);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(() => new Map(available.map((o) => [o.id, o])), [available]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleConfirm = async () => {
    if (selectedShifts.length === 0) return;
    const payload: ShiftSelection[] = selectedShifts
      .map((id) => {
        const o = byId.get(id);
        if (!o) return null;
        return { id: o.id, name: o.label, time: o.time };
      })
      .filter(Boolean) as ShiftSelection[];

    setSaving(true);
    try {
      const result = await selectShiftsApi(payload);
      if (!result.success) {
        setSaving(false);
        appNotify.error(result.error ?? "Failed to save shifts. Please try again.");
        return;
      }
      await setSelectedShifts(payload);
      setSaving(false);
      router.replace("/collect-device");
    } catch {
      setSaving(false);
      appNotify.error("Failed to save shifts. Please try again.");
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.card }]} edges={["bottom", "left", "right"]}>
      <Header title="Select Your Shifts" showBack={false} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.intro, { color: colors.text.secondary }]}>
          Choose the shifts you are available to work. You can select multiple shifts.
        </Text>

        {!loadingList &&
          available.map((shift) => {
            const selected = selectedShifts.includes(shift.id);
            return (
              <TouchableOpacity
                key={shift.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: selected ? PURPLE : colors.background,
                    borderColor: selected ? PURPLE : colors.border.medium,
                  },
                ]}
                onPress={() => toggle(shift.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconWrap, { backgroundColor: selected ? "rgba(255,255,255,0.2)" : colors.gray[100] }]}>
                  <ShiftGlyph kind={shift.icon} color={selected ? "#FFFFFF" : colors.gray[700]} size={26} />
                </View>
                <View style={styles.cardMid}>
                  <Text style={[styles.cardTitle, { color: selected ? "#FFFFFF" : colors.text.primary }]}>{shift.label}</Text>
                  <Text style={[styles.cardTime, { color: selected ? "rgba(255,255,255,0.9)" : colors.text.secondary }]}>
                    {shift.time}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkBox,
                    {
                      borderColor: selected ? "#FFFFFF" : colors.border.dark,
                      backgroundColor: selected ? "#FFFFFF" : "transparent",
                    },
                  ]}
                >
                  {selected ? <Check color={PURPLE} size={18} strokeWidth={3} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}

        <Text style={[styles.note, { color: colors.text.secondary }]}>
          Note: Your actual shift schedule will be assigned by your manager. This is your preferred availability.
        </Text>
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border.light }]}>
        <PrimaryButton
          title="Confirm Shifts"
          onPress={() => void handleConfirm()}
          disabled={selectedShifts.length === 0 || saving}
          loading={saving}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
  intro: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cardMid: { flex: 1 },
  cardTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, marginBottom: 4 },
  cardTime: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.medium },
  checkBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  bottomSpacer: { height: 100 },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["2xl"],
    borderTopWidth: 1,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px -2px 8px rgba(0, 0, 0, 0.05)" }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        }),
  },
});
