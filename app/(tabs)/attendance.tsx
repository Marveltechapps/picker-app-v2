import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, FileText, Zap, Calendar as CalendarIcon, Clock, MapPin, Package, TrendingUp, X } from "lucide-react-native";
import { router } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { useAuth } from "@/state/authContext";
import { getAttendanceSummary, getAttendanceStats, type AttendanceDetail, type AttendanceSummary } from "@/services/attendance.service";
import { calculateOvertimePay, getOvertimeMultiplier } from "@/utils/payCalculations";

const { width } = Dimensions.get("window");

type TabType = "details" | "ot" | "history";

interface OTWeekData {
  week: string;
  dateRange: string;
  hours: number;
  earnings: number;
}

interface DayDetails {
  punchIn: string;
  punchOut: string;
  totalHours: number;
  warehouse: string;
  orders: number;
  incentive: number;
  overtime: number | null;
  status: "present" | "half-day" | "absent";
}

interface HistoryData {
  [date: string]: DayDetails;
}

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

function warehouseLabelFromRow(row: AttendanceDetail | undefined): string | null {
  if (!row) return null;
  const r = row as AttendanceDetail & Record<string, unknown>;
  const candidates = [r.warehouse, r.warehouseName, r.warehouse_name, r.hubName, r.locationName, r.storeName];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function historyFromSummary(summary: AttendanceSummary | null): HistoryData {
  if (!summary?.history?.length) return {};
  const out: HistoryData = {};
  for (const d of summary.history) {
    const key = formatDateKey(d.date);
    if (!key) continue;
    out[key] = {
      punchIn: formatTimeFromApi(d.punchIn),
      punchOut: formatTimeFromApi(d.punchOut),
      totalHours: d.totalHours ?? 0,
      warehouse: warehouseLabelFromRow(d) ?? "—",
      orders: d.orders ?? 0,
      incentive: d.incentive ?? 0,
      overtime: d.overtime ?? null,
      status: (d.status as "present" | "half-day" | "absent") || "present",
    };
  }
  return out;
}

function otWeeksFromSummary(summary: AttendanceSummary | null, month: string, year: number): OTWeekData[] {
  if (!summary?.ot?.length) return [];
  const monthIdx = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(month);
  if (monthIdx < 0) return [];
  const weekBuckets: { weekIndex: number; hours: number; earnings: number }[] = [];
  for (const d of summary.ot) {
    const key = formatDateKey(d.date);
    const date = key ? new Date(key) : null;
    if (!date || date.getMonth() !== monthIdx || date.getFullYear() !== year) continue;
    const day = date.getDate();
    const weekIndex = Math.floor((day - 1) / 7);
    const hrs = typeof d.overtime === "number" ? d.overtime : 0;
    const earnings = calculateOvertimePay(hrs);
    const existing = weekBuckets.find((b) => b.weekIndex === weekIndex);
    if (existing) {
      existing.hours += hrs;
      existing.earnings += earnings;
    } else {
      weekBuckets.push({ weekIndex, hours: hrs, earnings });
    }
  }
  weekBuckets.sort((a, b) => a.weekIndex - b.weekIndex);
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  return weekBuckets.map((b) => {
    const startDay = b.weekIndex * 7 + 1;
    const endDay = Math.min(startDay + 6, daysInMonth);
    const monthShort = month.slice(0, 3);
    return {
      week: `Week ${b.weekIndex + 1}`,
      dateRange: `${monthShort} ${startDay}-${endDay}`,
      hours: Math.round(b.hours * 10) / 10,
      earnings: Math.round(b.earnings),
    };
  });
}

export default function AttendanceScreen() {
  const { selectedShifts, shiftStartTime, shiftActive, unreadCount } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("details");
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.toLocaleString("en-US", { month: "long" }));
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [statsHubName, setStatsHubName] = useState<string | null>(null);

  const monthIndex = (m: string) => {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return months.indexOf(m);
  };

  useEffect(() => {
    const m = monthIndex(selectedMonth);
    if (m >= 0) {
      getAttendanceSummary({ month: m, year: selectedYear }).then(setAttendanceSummary);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    getAttendanceStats().then((s) => {
      const h = s?.hubName?.trim();
      setStatsHubName(h || null);
    });
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (shiftActive && shiftStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - shiftStartTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [shiftActive, shiftStartTime]);

  const formatElapsedTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate shift completion percentage in real-time
  const calculateShiftProgress = () => {
    const scheduledHours = 9; // 9 hours shift
    const scheduledSeconds = scheduledHours * 3600; // Convert to seconds
    if (!shiftActive || elapsedTime === 0) return 0;
    const percentage = Math.min((elapsedTime / scheduledSeconds) * 100, 100);
    return Math.round(percentage);
  };

  const shiftProgress = calculateShiftProgress();
  const circumference = 2 * Math.PI * 36;
  const progressOffset = circumference - (circumference * shiftProgress) / 100;

  const getShiftTimes = (): { startTime: string; endTime: string } => {
    if (selectedShifts.length > 0) {
      const shiftTime = (selectedShifts[0].time || "").trim();
      // Support " - ", " – " (en-dash), or " -" / "- " so AM/PM always parses correctly
      const parts = shiftTime.split(/\s*[-–]\s*/);
      const startTime = (parts[0] || "").trim() || "9:00 AM";
      const endTime = (parts[1] || "").trim() || "6:00 PM";
      return { startTime, endTime };
    }
    return { startTime: "9:00 AM", endTime: "6:00 PM" };
  };

  const { startTime, endTime } = getShiftTimes();
  
  const getPunchInTime = () => {
    if (shiftStartTime) {
      const date = new Date(shiftStartTime);
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    }
    return startTime;
  };

  // Calculate OT earnings using centralized calculation utility
  const historyData = useMemo(() => historyFromSummary(attendanceSummary), [attendanceSummary]);
  const currentMonthData = useMemo(
    () => otWeeksFromSummary(attendanceSummary, selectedMonth, selectedYear),
    [attendanceSummary, selectedMonth, selectedYear]
  );
  const totalOTHours = currentMonthData.reduce((sum, week) => sum + week.hours, 0);
  const totalOTEarnings = currentMonthData.reduce((sum, week) => sum + week.earnings, 0);

  const warehouseFromApi =
    warehouseLabelFromRow(attendanceSummary?.details?.[0]) ?? statsHubName ?? null;

  const getDaysInMonth = (month: string, year: number) => {
    const monthIndex = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(month);
    return new Date(year, monthIndex + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: string, year: number) => {
    const monthIndex = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(month);
    return new Date(year, monthIndex, 1).getDay();
  };

  const getDayStatus = (day: number) => {
    const monthIndex = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(selectedMonth);
    const dateKey = `${selectedYear}-${(monthIndex + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    const dayData = historyData?.[dateKey];
    if (!dayData) return null;
    if (dayData.overtime) return "overtime";
    if (dayData.status === "half-day") return "half-day";
    return "present";
  };

  const renderDetailsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "details" && styles.tabActive]}
          onPress={() => setActiveTab("details")}
        >
          <FileText size={20} color={activeTab === "details" ? "#5B4EFF" : "#9CA3AF"} />
          <Text style={[styles.tabText, activeTab === "details" && styles.tabTextActive]}>Details</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "ot" && styles.tabActive]}
          onPress={() => setActiveTab("ot")}
        >
          <Zap size={20} color={activeTab === "ot" ? "#5B4EFF" : "#9CA3AF"} />
          <Text style={[styles.tabText, activeTab === "ot" && styles.tabTextActive]}>OT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "history" && styles.tabActive]}
          onPress={() => setActiveTab("history")}
        >
          <CalendarIcon size={20} color={activeTab === "history" ? "#5B4EFF" : "#9CA3AF"} />
          <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>History</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.combinedStatusCard}>
        <View style={styles.combinedStatusLeft}>
          <View style={styles.combinedStatusRow}>
            <View style={styles.topGreenDot} />
            <Text style={styles.topStatusTitle}>Present</Text>
          </View>
          <View style={styles.topTimeRow}>
            <Clock size={16} color="#6B7280" />
            <View style={styles.topTimeTextWrap}>
              <Text style={styles.topTimeText} numberOfLines={2}>{startTime} – {endTime}</Text>
            </View>
          </View>
          <View style={styles.topCheckRow}>
            <View style={styles.topCheckIcon}>
              <Text style={styles.topCheckMark}>✓</Text>
            </View>
            <Text style={styles.topCheckText}>Punched in on time</Text>
          </View>
          <View style={styles.topHoursSection}>
            <Text style={styles.topHoursLabel}>Hours Worked Today</Text>
            <Text style={styles.topHoursTime}>{formatElapsedTime(elapsedTime)}</Text>
          </View>
        </View>
        <View style={styles.topStatusRight}>
          <View style={styles.topProgressCircle}>
            <Svg width={90} height={90}>
              <Circle cx={45} cy={45} r={36} stroke="#E5E7EB" strokeWidth={8} fill="none" />
              <Circle
                cx={45}
                cy={45}
                r={36}
                stroke="#8B5CF6"
                strokeWidth={8}
                fill="none"
                strokeDasharray={`${circumference * (shiftProgress / 100)} ${circumference}`}
                strokeLinecap="round"
                rotation="-90"
              />
            </Svg>
            <Text style={styles.topProgressText}>{shiftProgress}%</Text>
          </View>
        </View>
      </View>

      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Warehouse</Text>
          <Text style={styles.detailValue}>{warehouseFromApi ?? "—"}</Text>
        </View>
        <View style={styles.detailDivider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Punch In</Text>
          <Text style={styles.detailValue}>{getPunchInTime()}</Text>
        </View>
        <View style={styles.detailDivider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Expected Punch Out</Text>
          <Text style={styles.detailValue}>{endTime}</Text>
        </View>
        <View style={styles.detailDivider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Scheduled Hours</Text>
          <Text style={styles.detailValue}>9 hrs</Text>
        </View>
        <View style={styles.detailDivider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status</Text>
          <View style={styles.activeStatus}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Active</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderOTTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "details" && styles.tabActive]}
          onPress={() => setActiveTab("details")}
        >
          <FileText size={20} color={activeTab === "details" ? "#5B4EFF" : "#9CA3AF"} />
          <Text style={[styles.tabText, activeTab === "details" && styles.tabTextActive]}>Details</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "ot" && styles.tabActive]}
          onPress={() => setActiveTab("ot")}
        >
          <Zap size={20} color={activeTab === "ot" ? "#5B4EFF" : "#9CA3AF"} />
          <Text style={[styles.tabText, activeTab === "ot" && styles.tabTextActive]}>OT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "history" && styles.tabActive]}
          onPress={() => setActiveTab("history")}
        >
          <CalendarIcon size={20} color={activeTab === "history" ? "#5B4EFF" : "#9CA3AF"} />
          <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>History</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.combinedStatusCard}>
        <View style={styles.combinedStatusLeft}>
          <View style={styles.combinedStatusRow}>
            <View style={styles.topGreenDot} />
            <Text style={styles.topStatusTitle}>Present</Text>
          </View>
          <View style={styles.topTimeRow}>
            <Clock size={16} color="#6B7280" />
            <View style={styles.topTimeTextWrap}>
              <Text style={styles.topTimeText} numberOfLines={2}>{startTime} – {endTime}</Text>
            </View>
          </View>
          <View style={styles.topCheckRow}>
            <View style={styles.topCheckIcon}>
              <Text style={styles.topCheckMark}>✓</Text>
            </View>
            <Text style={styles.topCheckText}>Punched in on time</Text>
          </View>
          <View style={styles.topHoursSection}>
            <Text style={styles.topHoursLabel}>Hours Worked Today</Text>
            <Text style={styles.topHoursTime}>{formatElapsedTime(elapsedTime)}</Text>
          </View>
        </View>
        <View style={styles.topStatusRight}>
          <View style={styles.topProgressCircle}>
            <Svg width={90} height={90}>
              <Circle cx={45} cy={45} r={36} stroke="#E5E7EB" strokeWidth={8} fill="none" />
              <Circle
                cx={45}
                cy={45}
                r={36}
                stroke="#8B5CF6"
                strokeWidth={8}
                fill="none"
                strokeDasharray={`${circumference * (shiftProgress / 100)} ${circumference}`}
                strokeLinecap="round"
                rotation="-90"
              />
            </Svg>
            <Text style={styles.topProgressText}>{shiftProgress}%</Text>
          </View>
        </View>
      </View>

      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => {
          const monthIndex = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(selectedMonth);
          if (monthIndex === 0) {
            setSelectedYear(selectedYear - 1);
            setSelectedMonth("December");
          } else {
            setSelectedMonth(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][monthIndex - 1]);
          }
        }}>
          <Text style={styles.monthArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthText}>{selectedMonth} {selectedYear}</Text>
        <TouchableOpacity onPress={() => {
          const monthIndex = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(selectedMonth);
          if (monthIndex === 11) {
            setSelectedYear(selectedYear + 1);
            setSelectedMonth("January");
          } else {
            setSelectedMonth(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][monthIndex + 1]);
          }
        }}>
          <Text style={styles.monthArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.otSummaryCard}>
        <View style={styles.otSummaryLeft}>
          <Text style={styles.otSummaryLabel}>Total OT Hours</Text>
          <Text style={styles.otSummaryHours}>{totalOTHours} hrs</Text>
          <View style={styles.otRateRow}>
            <Text style={styles.otRateLabel}>OT Rate</Text>
            <Text style={styles.otRateValue}>{getOvertimeMultiplier()}x</Text>
          </View>
        </View>
        <View style={styles.otIconWrapper}>
          <Zap size={32} color="#FFFFFF" fill="#FFFFFF" />
        </View>
      </View>

      {currentMonthData.length > 0 ? (
        <>
          <Text style={styles.weeklyTitle}>Weekly Breakdown</Text>
          {currentMonthData.map((week, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.weekCard,
                selectedWeek === week.week && styles.weekCardSelected,
              ]}
              onPress={() => setSelectedWeek(selectedWeek === week.week ? null : week.week)}
            >
              <View style={styles.weekLeft}>
                <Text style={styles.weekTitle}>{week.week}</Text>
                <Text style={styles.weekRange}>{week.dateRange}</Text>
              </View>
              <View style={styles.weekRight}>
                <Text style={[styles.weekHours, selectedWeek === week.week && styles.weekHoursSelected]}>
                  {week.hours} hrs
                </Text>
                <Text style={[styles.weekEarnings, selectedWeek === week.week && styles.weekEarningsSelected]}>
                  ₹{week.earnings}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {selectedWeek && (() => {
            const weekData = currentMonthData.find((w) => w.week === selectedWeek);
            if (!weekData) return null;
            return (
              <View style={styles.weekDetailsCard}>
                <View style={styles.weekDetailsHeader}>
                  <Text style={styles.weekDetailsTitle}>{selectedWeek}</Text>
                  <Text style={styles.weekDetailsSubtitle}>Details</Text>
                </View>
                <TouchableOpacity style={styles.weekDetailsClose} onPress={() => setSelectedWeek(null)}>
                  <X size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.weekDetailsGrid}>
                  <View style={styles.weekDetailBox}>
                    <Clock size={20} color="#8B5CF6" />
                    <Text style={styles.weekDetailLabel}>OT Hours</Text>
                    <Text style={styles.weekDetailValue}>{weekData.hours}</Text>
                  </View>
                  <View style={styles.weekDetailBox}>
                    <Zap size={20} color="#8B5CF6" />
                    <Text style={styles.weekDetailLabel}>OT Rate</Text>
                    <Text style={styles.weekDetailValue}>{getOvertimeMultiplier()}x</Text>
                  </View>
                  <View style={styles.weekDetailBox}>
                    <Text style={styles.weekDetailIcon}>₹</Text>
                    <Text style={styles.weekDetailLabel}>Base Rate</Text>
                    <Text style={styles.weekDetailValue}>₹100/hr</Text>
                  </View>
                  <View style={[styles.weekDetailBox, styles.weekDetailBoxHighlight]}>
                    <TrendingUp size={20} color="#F59E0B" />
                    <Text style={styles.weekDetailLabel}>Earnings</Text>
                    <Text style={styles.weekDetailValue}>₹{weekData.earnings}</Text>
                  </View>
                </View>
                <View style={styles.calculationBox}>
                  <Text style={styles.calculationLabel}>Calculation:</Text>
                  <Text style={styles.calculationText}>
                    {weekData.hours} hrs × ₹100 × {getOvertimeMultiplier()} = <Text style={styles.calculationHighlight}>₹{weekData.earnings}</Text>
                  </Text>
                </View>
              </View>
            );
          })()}

          <View style={styles.totalEarningsCard}>
            <View style={styles.totalEarningsIcon}>
              <TrendingUp size={24} color="#FFFFFF" />
            </View>
            <View style={styles.totalEarningsContent}>
              <Text style={styles.totalEarningsLabel}>Total OT Earnings</Text>
              <Text style={styles.totalEarningsValue}>₹{totalOTEarnings}</Text>
              <Text style={styles.totalEarningsMonth}>for {selectedMonth} {selectedYear}</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Zap size={48} color="#D1D5DB" />
          </View>
          <Text style={styles.emptyText}>No overtime hours recorded</Text>
          <Text style={styles.emptySubtext}>for {selectedMonth} {selectedYear}</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderHistoryTab = () => {
    const monthIndex = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(selectedMonth);
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const firstDay = getFirstDayOfMonth(selectedMonth, selectedYear);
    const calendarDays: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push(day);
    }

    const presentDays = Object.values(historyData || {}).filter(d => d && d.status === "present").length;
    const halfDays = Object.values(historyData || {}).filter(d => d && d.status === "half-day").length;

    const selectedDateKey = selectedDate ? `${selectedYear}-${(monthIndex + 1).toString().padStart(2, "0")}-${selectedDate.padStart(2, "0")}` : null;
    const selectedDayData = selectedDateKey && historyData ? historyData[selectedDateKey] : null;

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "details" && styles.tabActive]}
            onPress={() => setActiveTab("details")}
          >
            <FileText size={20} color={activeTab === "details" ? "#5B4EFF" : "#9CA3AF"} />
            <Text style={[styles.tabText, activeTab === "details" && styles.tabTextActive]}>Details</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "ot" && styles.tabActive]}
            onPress={() => setActiveTab("ot")}
          >
            <Zap size={20} color={activeTab === "ot" ? "#5B4EFF" : "#9CA3AF"} />
            <Text style={[styles.tabText, activeTab === "ot" && styles.tabTextActive]}>OT</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "history" && styles.tabActive]}
            onPress={() => setActiveTab("history")}
          >
            <CalendarIcon size={20} color={activeTab === "history" ? "#5B4EFF" : "#9CA3AF"} />
            <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>History</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.combinedStatusCard}>
          <View style={styles.combinedStatusLeft}>
            <View style={styles.combinedStatusRow}>
              <View style={styles.topGreenDot} />
              <Text style={styles.topStatusTitle}>Present</Text>
            </View>
            <View style={styles.topTimeRow}>
              <Clock size={16} color="#6B7280" />
              <View style={styles.topTimeTextWrap}>
                <Text style={styles.topTimeText} numberOfLines={2}>{startTime} – {endTime}</Text>
              </View>
            </View>
            <View style={styles.topCheckRow}>
              <View style={styles.topCheckIcon}>
                <Text style={styles.topCheckMark}>✓</Text>
              </View>
              <Text style={styles.topCheckText}>Punched in on time</Text>
            </View>
            <View style={styles.topHoursSection}>
              <Text style={styles.topHoursLabel}>Hours Worked Today</Text>
              <Text style={styles.topHoursTime}>{formatElapsedTime(elapsedTime)}</Text>
            </View>
          </View>
          <View style={styles.topStatusRight}>
            <View style={styles.topProgressCircle}>
              <Svg width={90} height={90}>
                <Circle cx={45} cy={45} r={36} stroke="#E5E7EB" strokeWidth={8} fill="none" />
                <Circle
                  cx={45}
                  cy={45}
                  r={36}
                  stroke="#8B5CF6"
                  strokeWidth={8}
                  fill="none"
                  strokeDasharray={`${circumference * (shiftProgress / 100)} ${circumference}`}
                  strokeLinecap="round"
                  rotation="-90"
                />
              </Svg>
              <Text style={styles.topProgressText}>{shiftProgress}%</Text>
            </View>
          </View>
        </View>

        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={() => {
            const monthIndex = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(selectedMonth);
            if (monthIndex === 0) {
              setSelectedYear(selectedYear - 1);
              setSelectedMonth("December");
            } else {
              setSelectedMonth(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][monthIndex - 1]);
            }
          }}>
            <Text style={styles.monthArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthText}>{selectedMonth} {selectedYear}</Text>
          <TouchableOpacity onPress={() => {
            const monthIndex = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(selectedMonth);
            if (monthIndex === 11) {
              setSelectedYear(selectedYear + 1);
              setSelectedMonth("January");
            } else {
              setSelectedMonth(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][monthIndex + 1]);
            }
          }}>
            <Text style={styles.monthArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.calendarGrid}>
          <View style={styles.weekDaysRow}>
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
              <Text key={index} style={styles.weekDayText}>{day}</Text>
            ))}
          </View>
          {Array.from({ length: Math.ceil(calendarDays.length / 7) }, (_, weekIndex) => (
            <View key={weekIndex} style={styles.calendarWeek}>
              {calendarDays.slice(weekIndex * 7, weekIndex * 7 + 7).map((day, dayIndex) => {
                const status = day ? getDayStatus(day) : null;
                const isSelected = Boolean(day && selectedDate === day.toString());
                return (
                  <TouchableOpacity
                    key={dayIndex}
                    style={styles.calendarDay}
                    onPress={() => day && setSelectedDate(day.toString())}
                    disabled={!day}
                  >
                    {day ? (
                      <>
                        <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}>
                          <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day}</Text>
                        </View>
                        {status && (
                          <View
                            style={[
                              styles.dayDot,
                              status === "present" && styles.dayDotPresent,
                              status === "half-day" && styles.dayDotHalfDay,
                              status === "overtime" && styles.dayDotOvertime,
                            ]}
                          />
                        )}
                      </>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.summaryCards}>
          <View style={styles.summaryCardGreen}>
            <Text style={styles.summaryNumber}>{presentDays}</Text>
            <Text style={styles.summaryLabel}>Present Days</Text>
          </View>
          <View style={styles.summaryCardYellow}>
            <Text style={styles.summaryNumber}>{halfDays}</Text>
            <Text style={styles.summaryLabel}>Half Days</Text>
          </View>
        </View>

        <Modal
          visible={!!selectedDate && !!selectedDayData}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedDate(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.dayDetailsModal}>
              <View style={styles.dayDetailsHeader}>
                <View>
                  <Text style={styles.dayDetailsTitle}>{selectedMonth} {selectedDate}</Text>
                  <Text style={styles.dayDetailsSubtitle}>Attendance Details</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedDate(null)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {selectedDayData && (
                <>
                  <View style={styles.workHoursSection}>
                    <View style={styles.workHoursHeader}>
                      <Clock size={20} color="#8B5CF6" />
                      <Text style={styles.workHoursTitle}>Work Hours</Text>
                    </View>
                    <View style={styles.workHoursGrid}>
                      <View style={styles.workHoursCol}>
                        <Text style={styles.workHoursLabel}>Punch In</Text>
                        <Text style={styles.workHoursValue}>{selectedDayData.punchIn}</Text>
                      </View>
                      <View style={styles.workHoursCol}>
                        <Text style={styles.workHoursLabel}>Punch Out</Text>
                        <Text style={styles.workHoursValue}>{selectedDayData.punchOut}</Text>
                      </View>
                    </View>
                    <View style={styles.totalHoursBox}>
                      <Text style={styles.totalHoursLabel}>Total Hours</Text>
                      <Text style={styles.totalHoursValue}>{selectedDayData.totalHours} hrs</Text>
                    </View>
                  </View>

                  <View style={styles.detailsGrid}>
                    <View style={styles.detailsGridItem}>
                      <View style={styles.detailsIconBlue}>
                        <MapPin size={20} color="#3B82F6" />
                      </View>
                      <Text style={styles.detailsGridLabel}>Warehouse</Text>
                      <Text style={styles.detailsGridValue}>{selectedDayData.warehouse}</Text>
                    </View>
                    <View style={styles.detailsGridItem}>
                      <View style={styles.detailsIconGreen}>
                        <Package size={20} color="#10B981" />
                      </View>
                      <Text style={styles.detailsGridLabel}>Orders</Text>
                      <Text style={styles.detailsGridValue}>{selectedDayData.orders}</Text>
                    </View>
                  </View>

                  <View style={styles.detailsGrid}>
                    <View style={styles.detailsGridItem}>
                      <View style={styles.detailsIconGreenBg}>
                        <TrendingUp size={20} color="#10B981" />
                      </View>
                      <Text style={styles.detailsGridLabel}>Incentive</Text>
                      <Text style={styles.detailsGridValue}>₹{selectedDayData.incentive}</Text>
                    </View>
                    <View style={styles.detailsGridItem}>
                      <View style={styles.detailsIconGray}>
                        <Zap size={20} color="#9CA3AF" />
                      </View>
                      <Text style={styles.detailsGridLabel}>Overtime</Text>
                      <Text style={[styles.detailsGridValue, styles.detailsGridValueGray]}>
                        {selectedDayData.overtime ? `${selectedDayData.overtime} hrs` : "None"}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      {activeTab === "details" && renderDetailsTab()}
      {activeTab === "ot" && renderOTTab()}
      {activeTab === "history" && renderHistoryTab()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  combinedStatusCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 0,
    padding: 20,
    marginTop: 0,
    marginBottom: 16,
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)', elevation: 2 }
      : { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }
    ),
  },
  combinedStatusLeft: {
    flex: 1,
  },
  combinedStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  topStatusCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  topStatusLeft: {
    flex: 1,
  },
  topStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  topGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  topStatusTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
  },
  topTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  topTimeTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  topTimeText: {
    fontSize: 13,
    color: "#6B7280",
  },
  topCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  topCheckIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  topCheckMark: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  topCheckText: {
    fontSize: 13,
    color: "#10B981",
  },
  topHoursSection: {
    marginTop: 4,
  },
  topHoursLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  topHoursTime: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  topStatusRight: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  topProgressCircle: {
    position: "relative" as const,
    alignItems: "center",
    justifyContent: "center",
  },
  topProgressText: {
    position: "absolute" as const,
    fontSize: 16,
    fontWeight: "700",
    color: "#8B5CF6",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 32,
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 2,
  },
  notificationButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    position: "relative" as const,
  },
  notificationDot: {
    position: "absolute" as const,
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginTop: 20,
    marginBottom: 16,
    borderRadius: 0,
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#5B4EFF",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  tabTextActive: {
    color: "#5B4EFF",
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  statusCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  statusLeft: {
    flex: 1,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10B981",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  timeText: {
    fontSize: 14,
    color: "#6B7280",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  checkText: {
    fontSize: 14,
    color: "#10B981",
  },
  statusRight: {
    alignItems: "center",
    justifyContent: "center",
  },
  progressCircle: {
    position: "relative" as const,
    alignItems: "center",
    justifyContent: "center",
  },
  progressText: {
    position: "absolute" as const,
    fontSize: 18,
    fontWeight: "700",
    color: "#8B5CF6",
  },
  hoursCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  hoursLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  hoursTime: {
    fontSize: 36,
    fontWeight: "700",
    color: "#111827",
  },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  detailDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  activeStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  activeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10B981",
  },
  monthSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  monthArrow: {
    fontSize: 24,
    fontWeight: "600",
    color: "#111827",
  },
  monthText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  otSummaryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#EDE9FE",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  otSummaryLeft: {
    flex: 1,
  },
  otSummaryLabel: {
    fontSize: 14,
    color: "#7C3AED",
    marginBottom: 8,
  },
  otSummaryHours: {
    fontSize: 32,
    fontWeight: "700",
    color: "#5B21B6",
    marginBottom: 12,
  },
  otRateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#C4B5FD",
  },
  otRateLabel: {
    fontSize: 14,
    color: "#7C3AED",
  },
  otRateValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#5B21B6",
  },
  otIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#5B4EFF",
    alignItems: "center",
    justifyContent: "center",
  },
  weeklyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  weekCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  weekCardSelected: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
  },
  weekLeft: {
    flex: 1,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  weekRange: {
    fontSize: 12,
    color: "#6B7280",
  },
  weekRight: {
    alignItems: "flex-end",
  },
  weekHours: {
    fontSize: 18,
    fontWeight: "700",
    color: "#5B4EFF",
    marginBottom: 4,
  },
  weekHoursSelected: {
    color: "#F59E0B",
  },
  weekEarnings: {
    fontSize: 12,
    color: "#6B7280",
  },
  weekEarningsSelected: {
    color: "#92400E",
  },
  weekDetailsCard: {
    backgroundColor: "#5B4EFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    position: "relative" as const,
  },
  weekDetailsHeader: {
    marginBottom: 16,
  },
  weekDetailsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  weekDetailsSubtitle: {
    fontSize: 16,
    color: "#C7D2FE",
  },
  weekDetailsClose: {
    position: "absolute" as const,
    top: 20,
    right: 20,
  },
  weekDetailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  weekDetailBox: {
    width: (width - 92) / 2, // Account for card padding (40px), screen padding (40px), and gap (12px)
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  weekDetailBoxHighlight: {
    backgroundColor: "#FEF3C7",
  },
  weekDetailIcon: {
    fontSize: 20,
    fontWeight: "700",
    color: "#8B5CF6",
    marginBottom: 4,
  },
  weekDetailLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    marginBottom: 4,
  },
  weekDetailValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  calculationBox: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    padding: 12,
  },
  calculationLabel: {
    fontSize: 12,
    color: "#C7D2FE",
    marginBottom: 4,
  },
  calculationText: {
    fontSize: 14,
    color: "#FFFFFF",
  },
  calculationHighlight: {
    fontWeight: "700",
    color: "#FDE047",
  },
  totalEarningsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  totalEarningsIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  totalEarningsContent: {
    flex: 1,
  },
  totalEarningsLabel: {
    fontSize: 14,
    color: "#065F46",
    marginBottom: 4,
  },
  totalEarningsValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#065F46",
    marginBottom: 2,
  },
  totalEarningsMonth: {
    fontSize: 12,
    color: "#059669",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  calendarGrid: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  weekDaysRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  weekDayText: {
    width: (width - 72) / 7,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  calendarWeek: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  calendarDay: {
    width: (width - 72) / 7,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative" as const,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleSelected: {
    backgroundColor: "#5B4EFF",
  },
  dayText: {
    fontSize: 14,
    color: "#111827",
  },
  dayTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  dayDot: {
    position: "absolute" as const,
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dayDotPresent: {
    backgroundColor: "#10B981",
  },
  dayDotHalfDay: {
    backgroundColor: "#F59E0B",
  },
  dayDotOvertime: {
    backgroundColor: "#5B4EFF",
  },
  summaryCards: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  summaryCardGreen: {
    flex: 1,
    backgroundColor: "#D1FAE5",
    borderRadius: 16,
    padding: 20,
  },
  summaryCardYellow: {
    flex: 1,
    backgroundColor: "#FEF3C7",
    borderRadius: 16,
    padding: 20,
  },
  summaryNumber: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#065F46",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  dayDetailsModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  dayDetailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  dayDetailsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  dayDetailsSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  workHoursSection: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  workHoursHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  workHoursTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  workHoursGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  workHoursCol: {
    flex: 1,
  },
  workHoursLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  workHoursValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  totalHoursBox: {
    backgroundColor: "#EDE9FE",
    borderRadius: 12,
    padding: 12,
  },
  totalHoursLabel: {
    fontSize: 12,
    color: "#7C3AED",
    marginBottom: 4,
  },
  totalHoursValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#5B21B6",
  },
  detailsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  detailsGridItem: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
  },
  detailsIconBlue: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  detailsIconGreen: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  detailsIconGreenBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  detailsIconGray: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  detailsGridLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  detailsGridValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  detailsGridValueGray: {
    color: "#6B7280",
  },
});
