import { ScrollView } from "@/utils/scrollables";
import { TouchableOpacity } from "@/utils/touchables";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, MapPin, Clock, Zap } from "lucide-react-native";
import Header from "@/components/Header";
import { calculateOvertimePay } from "@/utils/payCalculations";
import {
  getAttendanceSummary,
  type AttendanceSummary,
  type AttendanceDetail,
} from "@/services/attendance.service";

type TabType = "working" | "ot";
type DayStatus = "present" | "half" | "ot" | null;

interface DayData {
  date: number;
  status: DayStatus;
}

interface DayDetail {
  date: string;
  warehouse: string;
  ordersCompleted: number;
  shiftTime: string;
  regularHours: number;
  incentivesEarned?: number;
  overtimeHours?: number;
  otEarnings?: number;
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatTimeFromApi(isoOrString: string | undefined): string {
  if (!isoOrString) return "—";
  try {
    const d = new Date(isoOrString);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return "—";
  }
}

function formatDateKey(isoOrString: string | undefined): string {
  if (!isoOrString) return "";
  try {
    const d = new Date(isoOrString);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

function formatDisplayDate(dateKey: string): string {
  const [y, m, day] = dateKey.split("-");
  const monthIdx = parseInt(m, 10) - 1;
  if (Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return dateKey;
  return `${monthNames[monthIdx]} ${parseInt(day, 10)}, ${y}`;
}

function buildDetailsByDate(summary: AttendanceSummary | null): Record<string, AttendanceDetail> {
  const out: Record<string, AttendanceDetail> = {};
  if (!summary?.details?.length) return out;
  for (const d of summary.details) {
    const key = formatDateKey(d.date);
    if (key) out[key] = d;
  }
  return out;
}

function buildOtByDate(summary: AttendanceSummary | null): Record<string, AttendanceDetail> {
  const out: Record<string, AttendanceDetail> = {};
  if (!summary?.ot?.length) return out;
  for (const d of summary.ot) {
    const key = formatDateKey(d.date);
    if (key) out[key] = d;
  }
  return out;
}

function generateCalendarDays(
  month: number,
  year: number,
  tab: TabType,
  detailsByDate: Record<string, AttendanceDetail>,
  otByDate: Record<string, AttendanceDetail>
): DayData[] {
  const days: DayData[] = [];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    days.push({ date: 0, status: null });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const m = String(month + 1).padStart(2, "0");
    const d = String(i).padStart(2, "0");
    const dateKey = `${year}-${m}-${d}`;
    let status: DayStatus = null;

    if (tab === "working") {
      const detail = detailsByDate[dateKey];
      if (detail) {
        status = detail.status === "half-day" ? "half" : "present";
      }
    } else {
      status = otByDate[dateKey] ? "ot" : null;
    }
    days.push({ date: i, status });
  }
  return days;
}

function attendanceDetailToDayDetail(d: AttendanceDetail): DayDetail {
  const dateKey = formatDateKey(d.date);
  const dateStr = formatDisplayDate(dateKey);
  const punchIn = formatTimeFromApi(d.punchIn);
  const punchOut = formatTimeFromApi(d.punchOut);
  const shiftTime = punchOut ? `${punchIn} - ${punchOut}` : punchIn;
  const overtimeHours = typeof d.overtime === "number" ? d.overtime : undefined;
  const otEarnings = overtimeHours != null ? Math.round(calculateOvertimePay(overtimeHours)) : undefined;
  return {
    date: dateStr,
    warehouse: d.warehouse ?? "—",
    ordersCompleted: d.orders ?? 0,
    shiftTime,
    regularHours: d.totalHours ?? 0,
    incentivesEarned: d.incentive ?? undefined,
    overtimeHours,
    otEarnings,
  };
}

export default function WorkHistoryScreen() {
  const [activeTab, setActiveTab] = useState<TabType>("working");
  const [selectedDate, setSelectedDate] = useState<number>(0);
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!hasLoadedOnceRef.current) setLoading(true);
    getAttendanceSummary({ month: currentMonth, year: currentYear })
      .then((data) => {
        if (!cancelled) {
          setAttendanceSummary(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAttendanceSummary({ details: [], ot: [], history: [] });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          hasLoadedOnceRef.current = true;
        }
      });
    return () => { cancelled = true; };
  }, [currentMonth, currentYear]);

  const detailsByDate = useMemo(() => buildDetailsByDate(attendanceSummary), [attendanceSummary]);
  const otByDate = useMemo(() => buildOtByDate(attendanceSummary), [attendanceSummary]);

  const calendarDays = useMemo(
    () => generateCalendarDays(currentMonth, currentYear, activeTab, detailsByDate, otByDate),
    [currentMonth, currentYear, activeTab, detailsByDate, otByDate]
  );

  const { presentCount, halfCount, totalHours, workedDaysCount } = useMemo(() => {
    const details = attendanceSummary?.details ?? [];
    let present = 0;
    let half = 0;
    let hours = 0;
    for (const d of details) {
      if (d.status === "half-day") half++;
      else present++;
      hours += d.totalHours ?? 0;
    }
    return {
      presentCount: present,
      halfCount: half,
      totalHours: Math.round(hours * 10) / 10,
      workedDaysCount: details.length,
    };
  }, [attendanceSummary?.details]);

  const { otDaysCount, totalOTHours, totalOTEarnings } = useMemo(() => {
    const ot = attendanceSummary?.ot ?? [];
    let hours = 0;
    let earnings = 0;
    for (const d of ot) {
      const h = typeof d.overtime === "number" ? d.overtime : 0;
      hours += h;
      earnings += Math.round(calculateOvertimePay(h));
    }
    return {
      otDaysCount: ot.length,
      totalOTHours: Math.round(hours * 10) / 10,
      totalOTEarnings: earnings,
    };
  }, [attendanceSummary?.ot]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDate(0);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDate(0);
  };

  const handleDatePress = (date: number, status: DayStatus) => {
    if (status) {
      setSelectedDate(date);
    }
  };

  const getSelectedDayDetail = (): DayDetail | null => {
    if (!selectedDate) return null;
    const m = String(currentMonth + 1).padStart(2, "0");
    const d = String(selectedDate).padStart(2, "0");
    const dateKey = `${currentYear}-${m}-${d}`;
    const detail = activeTab === "working" ? detailsByDate[dateKey] : otByDate[dateKey];
    if (!detail) return null;
    return attendanceDetailToDayDetail(detail);
  };

  const selectedDetail = getSelectedDayDetail();
  const hasData =
    (attendanceSummary?.details?.length ?? 0) > 0 ||
    (attendanceSummary?.ot?.length ?? 0) > 0;
  const emptyState = !loading && !hasData;

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header title="Work History" subtitle="Track working days & overtime" />

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "working" && styles.activeTab]}
          onPress={() => {
            setActiveTab("working");
            setSelectedDate(0);
          }}
        >
          <Text style={[styles.tabText, activeTab === "working" && styles.activeTabText]}>
            Working days
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "ot" && styles.activeTab]}
          onPress={() => {
            setActiveTab("ot");
            setSelectedDate(0);
          }}
        >
          <Text style={[styles.tabText, activeTab === "ot" && styles.activeTabText]}>
            OT days
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <TouchableOpacity style={styles.monthButton} onPress={handlePrevMonth}>
              <ChevronLeft color="#111827" size={24} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.monthText}>
              {monthNames[currentMonth]} {currentYear}
            </Text>
            <TouchableOpacity style={styles.monthButton} onPress={handleNextMonth}>
              <ChevronRight color="#111827" size={24} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="large" color="#121358" />
              <Text style={styles.loadingText}>Loading…</Text>
            </View>
          ) : (
            <>
              <View style={styles.weekDays}>
                {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                  <Text key={index} style={styles.weekDayText}>{day}</Text>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {calendarDays.map((day, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.dayCell}
                    onPress={() => day.date > 0 && handleDatePress(day.date, day.status)}
                    disabled={!day.status}
                  >
                    {day.date > 0 && (
                      <>
                        <View
                          style={[
                            styles.dateCircle,
                            selectedDate === day.date && styles.selectedDateCircle,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dateText,
                              !day.status && styles.disabledDateText,
                              selectedDate === day.date && styles.selectedDateText,
                            ]}
                          >
                            {day.date}
                          </Text>
                        </View>
                        {day.status && (
                          <View
                            style={[
                              styles.statusDot,
                              day.status === "present" && styles.presentDot,
                              day.status === "half" && styles.halfDot,
                              day.status === "ot" && styles.otDot,
                            ]}
                          />
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {emptyState && (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No records for this month</Text>
                </View>
              )}

              {activeTab === "working" && (
                <View style={styles.summaryCards}>
                  <View style={styles.summaryCardSmall}>
                    <Text style={styles.summaryNumber}>{presentCount}</Text>
                    <Text style={styles.summaryLabel}>Present Days</Text>
                  </View>
                  <View style={[styles.summaryCardSmall, styles.summaryCardYellow]}>
                    <Text style={styles.summaryNumber}>{halfCount}</Text>
                    <Text style={styles.summaryLabel}>Half Days</Text>
                  </View>
                </View>
              )}

              {activeTab === "ot" && (
                <View style={styles.summaryCards}>
                  <View style={[styles.summaryCardSmall, styles.summaryCardYellow]}>
                    <Text style={styles.summaryNumber}>{otDaysCount}</Text>
                    <Text style={styles.summaryLabel}>OT Days</Text>
                  </View>
                  <View style={[styles.summaryCardSmall, styles.summaryCardOrange]}>
                    <Text style={styles.summaryNumberLarge}>{totalOTHours}</Text>
                    <Text style={styles.summaryLabel}>hrs</Text>
                  </View>
                </View>
              )}

              <View style={[
                styles.totalCard,
                activeTab === "ot" && styles.totalCardYellow
              ]}>
                <View style={styles.totalCardContent}>
                  <Clock color={activeTab === "working" ? "#121358" : "#FACC15"} size={24} strokeWidth={2} />
                  <Text style={styles.totalLabel}>
                    {activeTab === "working" ? "Total Hours" : "OT Earnings"}
                  </Text>
                </View>
                <Text style={styles.totalValue}>
                  {activeTab === "working" ? `${totalHours} hrs` : `₹${totalOTEarnings}`}
                </Text>
                {activeTab === "working" && (
                  <Text style={styles.totalSubtext}>
                    Worked {workedDaysCount} day{workedDaysCount !== 1 ? "s" : ""} this month
                  </Text>
                )}
                {activeTab === "ot" && (
                  <Text style={styles.totalSubtext}>At 1.25x rate • ₹125/hr</Text>
                )}
              </View>
            </>
          )}
        </View>

        {selectedDetail && (
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              {activeTab === "ot" && (
                <Zap color="#FACC15" size={20} strokeWidth={2} fill="#FACC15" />
              )}
              <Text style={styles.detailDate}>{selectedDetail.date}</Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailRowLeft}>
                <MapPin color="#121358" size={18} strokeWidth={2} />
                <Text style={styles.detailLabel}>Warehouse</Text>
              </View>
              <Text style={styles.detailValue}>{selectedDetail.warehouse}</Text>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Orders Completed</Text>
              <Text style={styles.detailValue}>{selectedDetail.ordersCompleted}</Text>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Shift Time</Text>
              <Text style={styles.detailValue}>{selectedDetail.shiftTime}</Text>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Regular Hours</Text>
              <Text style={styles.detailValue}>{selectedDetail.regularHours} hrs</Text>
            </View>

            {selectedDetail.overtimeHours != null && selectedDetail.overtimeHours > 0 && (
              <>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <View style={styles.detailRowLeft}>
                    <Zap color="#FACC15" size={18} strokeWidth={2} fill="#FACC15" />
                    <Text style={styles.detailLabel}>Overtime Hours</Text>
                  </View>
                  <Text style={[styles.detailValue, styles.otText]}>
                    {selectedDetail.overtimeHours} hrs
                  </Text>
                </View>
              </>
            )}

            {selectedDetail.otEarnings != null && selectedDetail.otEarnings > 0 && (
              <>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>OT Earnings</Text>
                  <Text style={[styles.detailValue, styles.earningsText]}>
                    ₹{selectedDetail.otEarnings}
                  </Text>
                </View>
              </>
            )}

            {selectedDetail.incentivesEarned != null && selectedDetail.incentivesEarned > 0 && (
              <>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <View style={styles.detailRowLeft}>
                    <Zap color="#10B981" size={18} strokeWidth={2} fill="#10B981" />
                    <Text style={styles.detailLabel}>Incentives Earned</Text>
                  </View>
                  <Text style={[styles.detailValue, styles.incentiveText]}>
                    ₹{selectedDetail.incentivesEarned}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "#F3F4F6",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  activeTabText: {
    color: "#121358",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  monthButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  monthText: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#111827",
  },
  loadingRow: {
    paddingVertical: 32,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: "#6B7280",
  },
  emptyRow: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#6B7280",
  },
  weekDays: {
    flexDirection: "row",
    marginBottom: 12,
  },
  weekDayText: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500" as const,
    color: "#9CA3AF",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  dateCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedDateCircle: {
    backgroundColor: "#121358",
  },
  dateText: {
    fontSize: 15,
    fontWeight: "500" as const,
    color: "#111827",
  },
  disabledDateText: {
    color: "#D1D5DB",
  },
  selectedDateText: {
    color: "#FFFFFF",
    fontWeight: "700" as const,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  presentDot: {
    backgroundColor: "#10B981",
  },
  halfDot: {
    backgroundColor: "#FACC15",
  },
  otDot: {
    backgroundColor: "#FACC15",
  },
  summaryCards: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  summaryCardSmall: {
    flex: 1,
    backgroundColor: "#DCFCE7",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  summaryCardYellow: {
    backgroundColor: "#FEF3C7",
  },
  summaryCardOrange: {
    backgroundColor: "#FFEDD5",
  },
  summaryNumber: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: "#10B981",
    marginBottom: 4,
  },
  summaryNumberLarge: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: "#F97316",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: "#6B7280",
  },
  totalCard: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    padding: 16,
  },
  totalCardYellow: {
    backgroundColor: "#FEF3C7",
  },
  totalCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#111827",
  },
  totalValue: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: "#111827",
    marginBottom: 4,
  },
  totalSubtext: {
    fontSize: 13,
    fontWeight: "400" as const,
    color: "#6B7280",
  },
  detailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  detailDate: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#111827",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  detailRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: "400" as const,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#111827",
  },
  otText: {
    color: "#FACC15",
  },
  earningsText: {
    color: "#F97316",
  },
  incentiveText: {
    color: "#10B981",
  },
  bottomSpacer: {
    height: 20,
  },
});
