import { ScrollView, scrollViewTouchProps } from "@/utils/scrollables";
import { TouchableCard } from "@/utils/touchables";
import React, { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, StyleSheet, StatusBar, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight, CheckCircle2, CreditCard, FileText } from "lucide-react-native";
import { useAuth } from "@/state/authContext";
import { fetchDocuments } from "@/utils/documentService";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";
import { appNotify } from "@/utils/appNotify";

// Document Card Component
function DocumentCard({ 
  title, 
  subtitle, 
  icon: Icon,
  iconColor,
  bgColor,
  isCompleted, 
  onPress 
}: { 
  title: string; 
  subtitle: string; 
  icon: typeof FileText;
  iconColor: string;
  bgColor: string;
  isCompleted: boolean; 
  onPress: () => void;
}) {
  return (
    <TouchableCard style={styles.documentCard} onPress={onPress}>
      <View style={styles.cardLeft}>
        <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
          <Icon color={iconColor} size={32} strokeWidth={2} />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>{title}</Text>
            {isCompleted && (
              <View style={styles.checkBadge}>
                <CheckCircle2 color="#FFFFFF" size={16} strokeWidth={2.5} />
              </View>
            )}
          </View>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <ChevronRight color="#9CA3AF" size={24} strokeWidth={2} />
    </TouchableCard>
  );
}

export default function DocumentsScreen() {
  const router = useRouter();
  const { documentUploads, completeDocuments, mergeDocumentsFromApi } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const res = await fetchDocuments();
          if (!active || !res.success || !res.documents) return;
          await mergeDocumentsFromApi(res.documents);
        } catch {
          // Non-blocking
        }
      })();
      return () => {
        active = false;
      };
    }, [mergeDocumentsFromApi])
  );

  const aadharUploaded = documentUploads.aadhar.front !== null && documentUploads.aadhar.back !== null;
  const panUploaded = documentUploads.pan.front !== null && documentUploads.pan.back !== null;
  const bothUploaded = aadharUploaded && panUploaded;

  const handleContinue = async () => {
    if (!bothUploaded) return;
    setLoading(true);
    try {
      await completeDocuments();
      router.replace("/didit-kyc");
    } catch {
      appNotify.error("Failed to submit documents. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header
        title="Upload Documents"
        subtitle="Complete your profile"
        onBackPress={() => {
          try {
            if (router.canGoBack()) router.back();
            else router.push("/verification");
          } catch {
            try { router.push("/verification"); } catch { /* fallback */ }
          }
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        {...scrollViewTouchProps}
      >
        <Text style={styles.subtitle}>Upload your Aadhar Card and PAN Card</Text>

        <View style={styles.guidelinesContainer}>
          <View style={styles.guidelinesHeader}>
            <FileText color="#6B7280" size={20} strokeWidth={2} />
            <Text style={styles.guidelinesTitle}>Document Guidelines</Text>
          </View>
          <View style={styles.guidelinesList}>
            <View style={styles.guidelineItem}>
              <View style={styles.guidelineBullet} />
              <Text style={styles.guidelineText}>Upload clear, readable copies of both front and back sides</Text>
            </View>
            <View style={styles.guidelineItem}>
              <View style={styles.guidelineBullet} />
              <Text style={styles.guidelineText}>Ensure all details are visible and not blurry</Text>
            </View>
            <View style={styles.guidelineItem}>
              <View style={styles.guidelineBullet} />
              <Text style={styles.guidelineText}>Make sure the document is well-lit and in focus</Text>
            </View>
            <View style={styles.guidelineItem}>
              <View style={styles.guidelineBullet} />
              <Text style={styles.guidelineText}>Both Aadhar Card and PAN Card must be uploaded to continue</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardsContainer}>
          <DocumentCard
            title="Aadhar Card"
            subtitle="Upload front and back"
            icon={CreditCard}
            iconColor="#4F46E5"
            bgColor="#EEEEF5"
            isCompleted={aadharUploaded}
            onPress={() => router.push('/aadhar-upload')}
          />

          <DocumentCard
            title="PAN Card"
            subtitle="Upload front and back"
            icon={FileText}
            iconColor="#F97316"
            bgColor="#FFEDD5"
            isCompleted={panUploaded}
            onPress={() => router.push('/pan-upload')}
          />
        </View>

        {bothUploaded && (
          <View style={styles.buttonContainer}>
            <PrimaryButton 
              title="Continue" 
              onPress={handleContinue}
              loading={loading}
            />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 24,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)', elevation: 2 }
      : { shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }
    ),
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: "#6B7280",
  },
  guidelinesContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  guidelinesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  guidelinesList: {
    gap: 12,
  },
  guidelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  guidelineBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#6B7280",
    marginTop: 6,
  },
  guidelineText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "400",
    color: "#6B7280",
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: 8,
    marginBottom: 20,
  },
  bottomSpacer: {
    height: 20,
  },
});
