import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  User,
  Mail,
  Send,
  Clock,
  CheckCircle2,
  Loader,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import Header from "@/components/Header";
import { getSupportTickets, createSupportTicket } from "@/services/support.service";
import { useAuth } from "@/state/authContext";

interface RecentTicket {
  id: string;
  title: string;
  status: string;
  statusColor: string;
  description: string;
  sentDate: string;
  updatedDate: string;
}

export default function ContactSupportScreen() {
  const router = useRouter();
  const { userProfile, phoneNumber } = useAuth();
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [resultModalType, setResultModalType] = useState<"success" | "fallback" | null>(null);

  useEffect(() => {
    getSupportTickets().then((list) => {
      setRecentTickets(
        list.slice(0, 4).map((t) => ({
          id: t.id,
          title: t.subject ?? t.category ?? "Ticket",
          status: t.status === "resolved" ? "Resolved" : t.status === "in_progress" ? "In Progress" : "Open",
          statusColor: t.status === "resolved" ? "#10B981" : t.status === "in_progress" ? "#F59E0B" : "#6B7280",
          description: t.message ?? "",
          sentDate: t.createdAt ? `Sent ${formatDate(t.createdAt)}` : "",
          updatedDate: t.updatedAt ? `Updated ${formatDate(t.updatedAt)}` : "",
        }))
      );
    }).finally(() => setLoadingTickets(false));
  }, []);

  function formatDate(s: string | undefined): string {
    if (!s) return "";
    const d = new Date(s);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
    return d.toLocaleDateString();
  }

  const categories = [
    "App Issue",
    "Payment",
    "Shift",
    "Device",
    "Documents",
    "Other",
  ];

  const recentEmails = recentTickets;

  const handleSubmit = async () => {
    if (!category || !subject.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const result = await createSupportTicket({ category, subject: subject.trim(), message: message.trim() });
      setSubmitting(false);
      if (result.success) {
        setResultModalType("success");
        setResultModalVisible(true);
        getSupportTickets().then((list) => {
          setRecentTickets(
            list.slice(0, 4).map((t) => ({
              id: t.id,
              title: t.subject ?? t.category ?? "Ticket",
              status: t.status === "resolved" ? "Resolved" : t.status === "in_progress" ? "In Progress" : "Open",
              statusColor: t.status === "resolved" ? "#10B981" : t.status === "in_progress" ? "#F59E0B" : "#6B7280",
              description: t.message ?? "",
              sentDate: t.createdAt ? `Sent ${formatDate(t.createdAt)}` : "",
              updatedDate: t.updatedAt ? `Updated ${formatDate(t.updatedAt)}` : "",
            }))
          );
        });
      } else {
        const supportEmail = "support@pickerapp.com";
        const mailtoUrl = `mailto:${supportEmail}?subject=${encodeURIComponent(`[${category}] ${subject}`)}&body=${encodeURIComponent(message)}`;
        Linking.openURL(mailtoUrl);
        setResultModalType("fallback");
        setResultModalVisible(true);
      }
    } catch {
      setSubmitting(false);
      const supportEmail = "support@pickerapp.com";
      Linking.openURL(`mailto:${supportEmail}?subject=${encodeURIComponent(`[${category}] ${subject}`)}&body=${encodeURIComponent(message)}`);
      setResultModalType("fallback");
      setResultModalVisible(true);
    }
  };

  const isFormValid = category && subject.trim() && message.trim();

  const closeResultModal = () => {
    setResultModalVisible(false);
    if (resultModalType === "success") {
      setCategory("");
      setSubject("");
      setMessage("");
    }
    setResultModalType(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header title="Contact Support" subtitle="We're here to help" />

      <Modal
        visible={resultModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeResultModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeResultModal} />
          <View style={styles.resultModalCard}>
            <View style={[styles.resultModalIconWrap, resultModalType === "success" ? styles.resultModalIconSuccess : styles.resultModalIconFallback]}>
              {resultModalType === "success" ? (
                <CheckCircle2 color="#10B981" size={48} strokeWidth={2} />
              ) : (
                <Mail color="#8B5CF6" size={48} strokeWidth={2} />
              )}
            </View>
            <Text style={styles.resultModalTitle}>
              {resultModalType === "success" ? "Ticket submitted" : "Email opened"}
            </Text>
            <Text style={styles.resultModalMessage}>
              {resultModalType === "success"
                ? "Your ticket has been submitted. We'll get back to you soon."
                : "Your email client was opened as a fallback. Send the message from there."}
            </Text>
            <TouchableOpacity
              style={styles.resultModalButton}
              onPress={closeResultModal}
              activeOpacity={0.85}
            >
              <Text style={styles.resultModalButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileIcon}>
            <User color="#8B5CF6" size={24} strokeWidth={2} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userProfile?.name?.trim() || "Picker"}</Text>
            <Text style={styles.profileEmail}>
              {userProfile?.email?.trim() || (phoneNumber ? `${phoneNumber}` : "Add email in profile")}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Compose Your Message</Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>
            Category<Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.categoryContainer}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  category === cat && styles.categoryChipActive,
                ]}
                onPress={() => setCategory(cat)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    category === cat && styles.categoryChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>
            Subject<Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Brief summary of your issue"
            placeholderTextColor="#9CA3AF"
            value={subject}
            onChangeText={setSubject}
            maxLength={100}
          />
          <Text style={styles.charCount}>{subject.length}/100 characters</Text>

          <Text style={styles.label}>
            Message<Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your issue in detail..."
            placeholderTextColor="#9CA3AF"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{message.length}/500 characters</Text>

          <View style={styles.infoBox}>
            <Mail color="#8B5CF6" size={16} strokeWidth={2} />
            <Text style={styles.infoText}>
              Your message will be sent to{" "}
              <Text style={styles.infoEmail}>support@pickerapp.com</Text> with
              your details attached
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, (!isFormValid || submitting) && styles.submitButtonDisabled]}
          activeOpacity={0.7}
          onPress={handleSubmit}
          disabled={!isFormValid || submitting}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Send color="#FFFFFF" size={20} strokeWidth={2} />}
          <View style={styles.submitButtonText}>
            <Text style={styles.submitButtonTitle}>
              {submitting ? "Submitting..." : isFormValid ? "Submit ticket" : "Fill in Required Fields"}
            </Text>
            <Text style={styles.submitButtonSubtitle}>
              {submitting ? "Please wait" : isFormValid ? "Sends to support" : "Category, subject, and message are required"}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.supportEmailCard}>
          <Mail color="#8B5CF6" size={24} strokeWidth={2} />
          <View style={styles.supportEmailInfo}>
            <Text style={styles.supportEmailTitle}>Support Email</Text>
            <Text style={styles.supportEmailAddress}>
              support@pickerapp.com
            </Text>
            <View style={styles.responseTime}>
              <Clock color="#9CA3AF" size={14} strokeWidth={2} />
              <Text style={styles.responseTimeText}>Response: 24-48 hours</Text>
            </View>
          </View>
        </View>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>What to Include in Your Email</Text>
          {[
            {
              number: "1",
              title: "Clear description",
              subtitle: "Explain your issue in detail",
            },
            {
              number: "2",
              title: "Screenshots (if applicable)",
              subtitle: "Attach relevant images",
            },
            {
              number: "3",
              title: "When it happened",
              subtitle: "Date and time of the issue",
            },
            {
              number: "4",
              title: "What you've tried",
              subtitle: "Steps you've already taken",
            },
          ].map((tip) => (
            <View key={tip.number} style={styles.tipItem}>
              <View style={styles.tipNumber}>
                <Text style={styles.tipNumberText}>{tip.number}</Text>
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipSubtitle}>{tip.subtitle}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Recent tickets</Text>

        {loadingTickets ? (
          <View style={styles.loadingTicketsWrap}>
            <ActivityIndicator color="#8B5CF6" />
            <Text style={styles.loadingTicketsText}>Loading tickets…</Text>
          </View>
        ) : null}

        {!loadingTickets && recentEmails.length === 0 ? (
          <Text style={styles.emptyTickets}>No tickets yet. Submit a message above to open a support request.</Text>
        ) : null}

        {recentEmails.map((email) => (
          <TouchableOpacity
            key={email.id}
            style={styles.emailCard}
            activeOpacity={0.7}
          >
            <View style={styles.emailHeader}>
              <View style={styles.emailIcon}>
                <Mail color="#8B5CF6" size={20} strokeWidth={2} />
              </View>
              <View style={styles.emailTitleContainer}>
                <Text style={styles.emailTitle}>{email.title}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: `${email.statusColor}20` },
                  ]}
                >
                  {email.status === "Resolved" ? (
                    <CheckCircle2
                      color={email.statusColor}
                      size={12}
                      strokeWidth={2}
                    />
                  ) : (
                    <Loader color={email.statusColor} size={12} strokeWidth={2} />
                  )}
                  <Text
                    style={[styles.statusText, { color: email.statusColor }]}
                  >
                    {email.status}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.emailDescription}>{email.description}</Text>
            <View style={styles.emailFooter}>
              <Clock color="#9CA3AF" size={14} strokeWidth={2} />
              <Text style={styles.emailDate}>{email.sentDate}</Text>
              <Text style={styles.emailSeparator}>•</Text>
              <Text style={styles.emailDate}>{email.updatedDate}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.quickTip}>
          <CheckCircle2 color="#10B981" size={20} strokeWidth={2} />
          <View style={styles.quickTipContent}>
            <Text style={styles.quickTipTitle}>Quick Tip</Text>
            <Text style={styles.quickTipText}>
              Check our FAQs section first - most common questions are answered
              there instantly!
            </Text>
          </View>
        </View>

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  profileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#111827",
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    fontWeight: "400" as const,
    color: "#6B7280",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#111827",
    marginBottom: 12,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)', elevation: 2 }
      : { shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }
    ),
  },
  label: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#111827",
    marginBottom: 8,
  },
  required: {
    color: "#EF4444",
  },
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  categoryChipActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#8B5CF6",
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: "#6B7280",
  },
  categoryChipTextActive: {
    color: "#8B5CF6",
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "400" as const,
    color: "#111827",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 4,
  },
  textArea: {
    height: 120,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    fontWeight: "400" as const,
    color: "#9CA3AF",
    textAlign: "right",
    marginBottom: 16,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "400" as const,
    color: "#6B7280",
    lineHeight: 18,
  },
  infoEmail: {
    color: "#8B5CF6",
    fontWeight: "600" as const,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8B5CF6",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  submitButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  submitButtonText: {
    flex: 1,
  },
  submitButtonTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#FFFFFF",
    marginBottom: 2,
  },
  submitButtonSubtitle: {
    fontSize: 13,
    fontWeight: "400" as const,
    color: "rgba(255, 255, 255, 0.8)",
  },
  supportEmailCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)', elevation: 2 }
      : { shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }
    ),
  },
  supportEmailInfo: {
    flex: 1,
  },
  supportEmailTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#111827",
    marginBottom: 4,
  },
  supportEmailAddress: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: "#8B5CF6",
    marginBottom: 8,
  },
  responseTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  responseTimeText: {
    fontSize: 13,
    fontWeight: "400" as const,
    color: "#9CA3AF",
  },
  tipsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)', elevation: 2 }
      : { shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }
    ),
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#111827",
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 12,
  },
  tipNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  tipNumberText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#8B5CF6",
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#111827",
    marginBottom: 2,
  },
  tipSubtitle: {
    fontSize: 13,
    fontWeight: "400" as const,
    color: "#6B7280",
  },
  emailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)', elevation: 2 }
      : { shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }
    ),
  },
  emailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 12,
  },
  emailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  emailTitleContainer: {
    flex: 1,
  },
  emailTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#111827",
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  emailDescription: {
    fontSize: 14,
    fontWeight: "400" as const,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 12,
  },
  emailFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emailDate: {
    fontSize: 12,
    fontWeight: "400" as const,
    color: "#9CA3AF",
  },
  emailSeparator: {
    fontSize: 12,
    color: "#D1D5DB",
  },
  quickTip: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#D1FAE5",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  quickTipContent: {
    flex: 1,
  },
  quickTipTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#065F46",
    marginBottom: 4,
  },
  quickTipText: {
    fontSize: 13,
    fontWeight: "400" as const,
    color: "#047857",
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  resultModalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 20px 40px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(139, 92, 246, 0.08)" }
      : { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 12 }),
  },
  resultModalIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  resultModalIconSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  resultModalIconFallback: {
    backgroundColor: "rgba(139, 92, 246, 0.12)",
  },
  resultModalTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#111827",
    marginBottom: 10,
    textAlign: "center",
  },
  resultModalMessage: {
    fontSize: 15,
    fontWeight: "400" as const,
    color: "#6B7280",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  resultModalButton: {
    backgroundColor: "#8B5CF6",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    minWidth: 140,
    alignItems: "center",
  },
  resultModalButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  loadingTicketsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    marginBottom: 8,
  },
  loadingTicketsText: {
    fontSize: 14,
    color: "#6B7280",
  },
  emptyTickets: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
    lineHeight: 20,
  },
});
