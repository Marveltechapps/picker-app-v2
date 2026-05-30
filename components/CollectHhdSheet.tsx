import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import BottomSheetModal from "./BottomSheetModal";
import { Smartphone, CheckCircle2 } from "lucide-react-native";
import PrimaryButton from "./PrimaryButton";

interface CollectHhdSheetProps {
  visible: boolean;
  onComplete: () => void;
  onBack: () => void;
  onClose: () => void;
}

export default function CollectHhdSheet({ 
  visible, 
  onComplete, 
  onBack, 
  onClose 
}: CollectHhdSheetProps) {
  const [collected, setCollected] = useState<boolean>(false);

  const handleComplete = () => {
    if (collected) {
      onComplete();
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} onBack={onBack} title="I've collected my device" height="75%" scrollable>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Smartphone color="#8B5CF6" size={56} strokeWidth={2} />
          </View>

          <Text style={styles.title}>Collect HHD Device</Text>
          <Text style={styles.subtitle}>
            Get your handheld device from supervisor
          </Text>

          <View style={styles.deviceCard}>
            <View style={styles.deviceIllustration}>
              <View style={styles.deviceScreen}>
                <Smartphone color="#6366F1" size={80} strokeWidth={1.5} />
              </View>
              <Text style={styles.deviceLabel}>Handheld Device (HHD)</Text>
            </View>
          </View>

          <View style={styles.stepsCard}>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Go to Supervisor Desk</Text>
                <Text style={styles.stepText}>Visit the supervisor&apos;s desk at the warehouse</Text>
              </View>
              <View style={styles.stepIcon}>
                <Text style={styles.stepIconText}>📍</Text>
              </View>
            </View>

            <View style={styles.stepDivider} />

            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Show Your OTP</Text>
                <Text style={styles.stepText}>Present the OTP code to verify your identity</Text>
              </View>
              <View style={styles.stepIcon}>
                <Text style={styles.stepIconText}>#️⃣</Text>
              </View>
            </View>

            <View style={styles.stepDivider} />

            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Collect Device</Text>
                <Text style={styles.stepText}>Receive your assigned HHD device</Text>
              </View>
              <View style={styles.stepIcon}>
                <Text style={styles.stepIconText}>📱</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.checkboxCard}
            onPress={() => setCollected(!collected)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, collected && styles.checkboxChecked]}>
              {collected && <CheckCircle2 color="#10B981" size={24} strokeWidth={2.5} fill="#10B981" />}
            </View>
            <Text style={styles.checkboxLabel}>
              I&apos;ve collected my handheld device
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            title="Start Work"
            onPress={handleComplete}
            disabled={!collected}
            style={collected ? styles.startWorkButton : undefined}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    flex: 1,
    paddingTop: 24,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  deviceCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    padding: 32,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  deviceIllustration: {
    alignItems: "center",
  },
  deviceScreen: {
    width: 160,
    height: 200,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "#E5E7EB",
  },
  deviceLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B7280",
  },
  stepsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  stepText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    lineHeight: 18,
  },
  stepIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIconText: {
    fontSize: 24,
  },
  stepDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 16,
    marginLeft: 44,
  },
  checkboxCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 20,
    gap: 16,
    borderWidth: 2,
    borderColor: "#D1FAE5",
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: "transparent",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#059669",
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  startWorkButton: {
    backgroundColor: "#10B981",
  },
});
