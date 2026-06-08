import { ScrollView } from "@/utils/scrollables";
import { TouchableOpacity } from "@/utils/touchables";
/**
 * Didit KYC Screen (Picker)
 *
 * One-time identity verification during onboarding.
 * Flow:
 *  1. POST /didit/session  → { sessionId, verificationUrl, alreadyVerified }
 *  2. Already verified → navigate forward immediately.
 *  3. Otherwise open verificationUrl in expo-web-browser.
 *  4. After browser closes, poll /didit/status until terminal state.
 *  5. APPROVED / REVIEW → /document-verification. DECLINED → show retry.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { CheckCircle2 } from 'lucide-react-native';
import Header from '@/components/Header';
import PrimaryButton from '@/components/PrimaryButton';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { ApiClientError } from '@/utils/apiClient';
import { createDigitSession, getDigitStatus } from '@/utils/diditApi';

function formatDiditError(e: unknown): string {
  if (e instanceof ApiClientError) {
    const msg = e.message || '';
    if (msg.includes('not configured') || msg.includes('must be set')) {
      return 'KYC verification is temporarily unavailable. Please try again later or contact support.';
    }
    if (e.status === 401) return 'Your session expired. Please log in again and retry.';
    if (e.status === 0) return msg;
    return msg || 'Could not start verification. Please try again.';
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

type Stage =
  | 'idle'       // not started
  | 'creating'   // calling backend to create session
  | 'verifying'  // browser open
  | 'polling'    // browser closed, checking status
  | 'approved'   // APPROVED
  | 'review'     // REVIEW – manual check pending
  | 'declined'   // DECLINED
  | 'error';     // network / config error

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20; // ~1 minute

export default function DiditKYCScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollCount = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const poll = useCallback(async () => {
    if (pollCount.current >= MAX_POLL_ATTEMPTS) {
      setStage('review');
      return;
    }
    pollCount.current += 1;

    try {
      const res = await getDigitStatus();
      const status = res.status;
      if (status === 'APPROVED') {
        setStage('approved');
      } else if (status === 'DECLINED') {
        setStage('declined');
      } else if (status === 'REVIEW') {
        setStage('review');
      } else {
        pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    } catch {
      pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
    }
  }, []);

  const startVerification = useCallback(async () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollCount.current = 0;
    setErrorMsg(null);
    setStage('creating');

    try {
      const res = await createDigitSession();

      if (res.alreadyVerified) {
        setStage('approved');
        return;
      }

      setStage('verifying');
      await WebBrowser.openBrowserAsync(res.verificationUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        showTitle: false,
      });

      setStage('polling');
      pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
    } catch (e) {
      setErrorMsg(formatDiditError(e));
      setStage('error');
    }
  }, [poll]);

  const handleContinue = () => {
    router.replace('/document-verification');
  };

  const handleBack = () => {
    try {
      if (router.canGoBack()) router.back();
      else router.replace('/documents');
    } catch {
      router.replace('/documents');
    }
  };

  const isLoading = stage === 'creating' || stage === 'verifying' || stage === 'polling';

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Header
        title="KYC Verification"
        subtitle="Powered by Didit"
        showBack
        onBackPress={handleBack}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {stage === 'idle' && <IdleCard />}
        {(stage === 'creating' || stage === 'verifying') && (
          <SpinnerBlock
            label={stage === 'creating' ? 'Preparing verification…' : 'Verification in progress…'}
          />
        )}
        {stage === 'polling' && <SpinnerBlock label="Checking your results…" />}
        {stage === 'approved' && <ApprovedBlock />}
        {stage === 'review' && <ReviewCard />}
        {stage === 'declined' && <DeclinedCard />}
        {stage === 'error' && <ErrorCard message={errorMsg} />}
      </ScrollView>

      <View style={styles.footer}>
        {(stage === 'approved' || stage === 'review') && (
          <PrimaryButton title="Continue" onPress={handleContinue} />
        )}
        {(stage === 'declined' || stage === 'error') && (
          <PrimaryButton title="Try Again" onPress={startVerification} />
        )}
        {isLoading && <PrimaryButton title="Please wait…" onPress={() => {}} loading />}
        {stage === 'idle' && (
          <PrimaryButton title="Start Verification" onPress={startVerification} />
        )}
      </View>
    </SafeAreaView>
  );
}

function IdleCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Identity Verification</Text>
      <Text style={styles.cardBody}>
        We use Didit to verify your identity quickly and securely. The process takes about{' '}
        <Text style={styles.bold}>2–3 minutes</Text> and requires:
      </Text>
      <View style={styles.bulletList}>
        {[
          'Aadhaar card (front & back)',
          'PAN card',
          'Live selfie for biometric match',
        ].map((item) => (
          <View key={item} style={styles.bulletRow}>
            <View style={styles.bullet} />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.noteText}>
        Your data is end-to-end encrypted and processed only for KYC purposes.
      </Text>
    </View>
  );
}

function SpinnerBlock({ label }: { label: string }) {
  return (
    <View style={styles.centeredBlock}>
      <ActivityIndicator size="large" color={Colors.primary[650]} />
      <Text style={styles.spinnerLabel}>{label}</Text>
    </View>
  );
}

function ApprovedBlock() {
  return (
    <View style={styles.centeredBlock}>
      <View style={styles.successCircle}>
        <CheckCircle2 color={Colors.white} size={48} strokeWidth={2} />
      </View>
      <Text style={styles.successTitle}>Verified!</Text>
      <Text style={styles.successSubtitle}>
        Your identity has been successfully verified by Didit.
      </Text>
    </View>
  );
}

function ReviewCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Under Review</Text>
      <Text style={styles.cardBody}>
        Your submission is being reviewed by Didit. This usually takes a few minutes. You can
        continue and check back later.
      </Text>
    </View>
  );
}

function DeclinedCard() {
  return (
    <View style={[styles.card, styles.cardError]}>
      <View style={styles.badgeError}>
        <Text style={styles.badgeErrorText}>Verification Failed</Text>
      </View>
      <Text style={styles.cardBody}>
        Didit was unable to verify your identity. Common reasons: blurry photos, mismatched face,
        or expired documents. Please try again.
      </Text>
    </View>
  );
}

function ErrorCard({ message }: { message: string | null }) {
  return (
    <View style={[styles.card, styles.cardError]}>
      <View style={styles.badgeError}>
        <Text style={styles.badgeErrorText}>Error</Text>
      </View>
      <Text style={styles.cardBody}>{message ?? 'An unexpected error occurred.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['3xl'],
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 1px 3px rgba(0,0,0,0.05)' }
      : { ...Shadows.sm }),
  },
  cardError: {
    borderColor: Colors.error[200],
    backgroundColor: Colors.error[50],
  },
  cardTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  cardBody: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  bold: {
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  bulletList: { gap: Spacing.sm },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary[650],
  },
  bulletText: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  noteText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary ?? Colors.text.secondary,
    fontStyle: 'italic',
  },
  centeredBlock: {
    alignItems: 'center',
    paddingTop: 80,
    gap: Spacing.lg,
  },
  spinnerLabel: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary[650],
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 8px 20px rgba(91,78,255,0.3)' }
      : {
          shadowColor: Colors.primary[650],
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 10,
        }),
  },
  successTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  successSubtitle: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    lineHeight: 22,
  },
  badgeError: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.error[100],
  },
  badgeErrorText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.error[600],
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    backgroundColor: Colors.card,
    ...Shadows.md,
  },
});
