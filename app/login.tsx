import { ScrollView } from "@/utils/scrollables";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import AuthHeader from "@/components/auth/AuthHeader";
import LoginMethodTabs from "@/components/auth/LoginMethodTabs";
import PhoneInputRow from "@/components/auth/PhoneInputRow";
import ConsentCheckbox from "@/components/auth/ConsentCheckbox";
import CountryPickerModal from "@/components/auth/CountryPickerModal";
import PolicyModal from "@/components/auth/PolicyModal";
import PrimaryButton from "@/components/PrimaryButton";
import { useAuthScreenTheme } from "@/hooks/useAuthScreenTheme";
import {
  COUNTRY_LIST,
  DEFAULT_COUNTRY_CODE,
  findCountryByCode,
  type CountryOption,
} from "@/lib/countries";
import {
  formatNationalAsYouType,
  stripDigits,
  truncatePhoneForCountry,
  validatePhone,
} from "@/lib/phoneValidation";
import {
  sendLoginOtp,
  validateEmailFormat,
  type LoginMode,
} from "@/services/auth.service";
import { logRouteTransition } from "@/utils/permissionDebug";
import { savePendingOtpSession } from "@/utils/pendingOtpSession";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "@/constants/storageKeys";

export default function LoginScreen() {
  const router = useRouter();
  const theme = useAuthScreenTheme();
  const { width: screenWidth } = useWindowDimensions();

  const [loginMode, setLoginMode] = useState<LoginMode>("mobile");
  const [country, setCountry] = useState<CountryOption>(
    () => findCountryByCode(DEFAULT_COUNTRY_CODE) ?? COUNTRY_LIST[0]
  );
  const [phoneDigits, setPhoneDigits] = useState("");
  const [email, setEmail] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [policyModal, setPolicyModal] = useState<"terms" | "privacy" | null>(null);
  const emailInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);

  const dismissKeyboard = useCallback(() => {
    emailInputRef.current?.blur();
    phoneInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  React.useEffect(() => {
    logRouteTransition("login", "mounted");
    dismissKeyboard();
  }, [dismissKeyboard]);

  const contentWidth = useMemo(
    () => Math.min(Math.max(screenWidth - 32, 320), 420),
    [screenWidth]
  );

  const formattedPhone = useMemo(
    () => formatNationalAsYouType(phoneDigits, country.code),
    [phoneDigits, country.code]
  );

  const phoneValidation = useMemo(() => {
    if (loginMode === "email") return null;
    return validatePhone(
      phoneDigits,
      country.code,
      loginMode === "whatsapp" ? "whatsapp" : "mobile"
    );
  }, [loginMode, phoneDigits, country.code]);

  const emailValid = useMemo(() => validateEmailFormat(email), [email]);

  const canSendOtp = useMemo(() => {
    if (loading || !consentChecked) return false;
    if (loginMode === "email") return emailValid;
    return !!phoneDigits && (phoneValidation?.valid ?? false);
  }, [loading, consentChecked, loginMode, emailValid, phoneDigits, phoneValidation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.pageBg,
        },
        formCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.xl,
          borderWidth: 1,
          borderColor: theme.colors.primaryMuted,
        },
        scroll: { flex: 1 },
        scrollContent: {
          flexGrow: 1,
          paddingHorizontal: theme.layout.contentPaddingH,
          paddingBottom: theme.spacing["2xl"],
        },
        content: {
          paddingTop: theme.spacing["2xl"],
        },
        methodLabel: {
          fontSize: theme.typography.fontSize.md,
          color: theme.colors.mutedText,
          marginBottom: theme.spacing.sm,
        },
        fieldSection: {
          marginTop: theme.spacing.xl,
          marginBottom: theme.spacing.xl,
        },
        fieldLabel: {
          fontSize: theme.typography.fontSize.md,
          color: theme.colors.textPrimary,
          marginBottom: theme.spacing.sm,
        },
        emailInput: {
          borderWidth: 1,
          borderColor: theme.colors.inputBorder,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.md + 2,
          fontSize: theme.typography.fontSize.lg,
          color: theme.colors.textPrimary,
          backgroundColor: theme.colors.inputBg,
        },
        inputFocus: {
          borderColor: theme.colors.inputFocus,
          borderWidth: 2,
        },
        inputError: {
          borderColor: theme.colors.inputBorderError,
          borderWidth: 2,
        },
        errorText: {
          marginTop: theme.spacing.sm,
          fontSize: theme.typography.fontSize.sm,
          color: theme.colors.inputBorderError,
        },
        consentSection: {
          marginBottom: theme.spacing.xl,
        },
        buttonContainer: {
          marginBottom: theme.spacing.lg,
        },
        authButton: {
          backgroundColor: theme.colors.primary,
          shadowColor: theme.colors.primary,
        },
      }),
    [theme]
  );

  const handleLoginModeChange = (mode: LoginMode) => {
    dismissKeyboard();
    setLoginMode(mode);
    setFieldError(null);
  };

  const handlePhoneChange = (text: string) => {
    const digits = truncatePhoneForCountry(stripDigits(text), country.code);
    setPhoneDigits(digits);
    if (fieldError) setFieldError(null);
    const validation = validatePhone(
      digits,
      country.code,
      loginMode === "whatsapp" ? "whatsapp" : "mobile"
    );
    if (validation.valid) {
      phoneInputRef.current?.blur();
      Keyboard.dismiss();
    }
  };

  const handleCountrySelect = (next: CountryOption) => {
    dismissKeyboard();
    setCountry(next);
    setPhoneDigits((prev) => truncatePhoneForCountry(prev, next.code));
    setFieldError(null);
  };

  const handleEmailChange = (text: string) => {
    const cleaned = text.replace(/\s/g, "");
    setEmail(cleaned);
    if (fieldError) setFieldError(null);
  };

  const handleSendOTP = async () => {
    if (!consentChecked) return;

    if (loginMode === "email") {
      const trimmed = email.trim();
      if (!trimmed) {
        setFieldError("Enter email address");
        return;
      }
      if (!validateEmailFormat(trimmed)) {
        setFieldError("Please enter a valid email address");
        return;
      }
    } else {
      if (!phoneDigits) {
        setFieldError(
          loginMode === "whatsapp" ? "Enter WhatsApp number" : "Enter mobile number"
        );
        return;
      }
      if (!phoneValidation?.valid) {
        setFieldError(phoneValidation?.message ?? "Invalid number format");
        return;
      }
    }

    dismissKeyboard();
    setLoading(true);
    setFieldError(null);

    try {
      const result = await sendLoginOtp({
        loginMode,
        countryCode: country.dialCode,
        phone: phoneDigits,
        email: email.trim().toLowerCase(),
      });

      if (result.success) {
        const otpTarget = loginMode === "email" ? "email" : "phone";
        const normalizedEmail = email.trim().toLowerCase();
        const displayTarget =
          loginMode === "email"
            ? normalizedEmail
            : `${country.dialCode} ${phoneDigits}`;
        const channel =
          result.channel ??
          (loginMode === "whatsapp" ? "whatsapp" : loginMode === "email" ? "email" : "sms");

        const otpSession = {
          loginMode,
          otpTarget,
          countryCode: country.dialCode,
          phone: phoneDigits,
          email: normalizedEmail,
          channel,
          displayTarget,
        };
        const persistTasks = [savePendingOtpSession(otpSession)];
        if (loginMode === "email") {
          persistTasks.push(
            AsyncStorage.setItem(STORAGE_KEYS.LOGIN_EMAIL, normalizedEmail)
          );
        }
        await Promise.all(persistTasks);

        router.push({
          pathname: "/otp",
          params: otpSession,
        });
      } else {
        setFieldError(result.error || result.message || "Failed to send OTP. Please try again.");
      }
    } catch {
      setFieldError("Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const phoneLabel = loginMode === "whatsapp" ? "WhatsApp Number" : "Mobile Number";
  const showPhoneInvalid = !!(phoneValidation?.showInvalid && fieldError === null && !phoneValidation.valid);

  return (
    <Pressable style={styles.container} onPress={dismissKeyboard} accessible={false}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <AuthHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, { width: contentWidth, alignSelf: "center" }]}>
          <View style={styles.formCard}>
          <Text style={styles.methodLabel}>Choose login method</Text>
          <LoginMethodTabs value={loginMode} onChange={handleLoginModeChange} />

          <View style={styles.fieldSection}>
            {loginMode === "email" ? (
              <View>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <TextInput
                  ref={emailInputRef}
                  style={[
                    styles.emailInput,
                    (emailFocused || email.length > 0) && !fieldError && styles.inputFocus,
                    fieldError && loginMode === "email" && styles.inputError,
                  ]}
                  placeholder="picker@example.com"
                  placeholderTextColor={theme.colors.placeholder}
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  blurOnSubmit
                  showSoftInputOnFocus
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  onSubmitEditing={dismissKeyboard}
                />
              </View>
            ) : (
              <PhoneInputRow
                country={country}
                value={formattedPhone}
                onChangeText={handlePhoneChange}
                onCountryPress={() => {
                  dismissKeyboard();
                  setCountryPickerVisible(true);
                }}
                hasError={!!fieldError || showPhoneInvalid}
                isFocused={phoneFocused}
                hasInput={phoneDigits.length > 0}
                label={phoneLabel}
                inputRef={phoneInputRef}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                onSubmitEditing={dismissKeyboard}
              />
            )}

            {fieldError ? <Text style={styles.errorText}>{fieldError}</Text> : null}
            {showPhoneInvalid && phoneValidation?.message ? (
              <Text style={styles.errorText}>{phoneValidation.message}</Text>
            ) : null}
          </View>

          <View style={styles.consentSection}>
            <ConsentCheckbox
              checked={consentChecked}
              onToggle={() => {
                dismissKeyboard();
                setConsentChecked((v) => !v);
              }}
              onTermsPress={() => {
                dismissKeyboard();
                setPolicyModal("terms");
              }}
              onPrivacyPress={() => {
                dismissKeyboard();
                setPolicyModal("privacy");
              }}
            />
          </View>

          <View style={styles.buttonContainer}>
            <PrimaryButton
              title="Send OTP"
              onPress={handleSendOTP}
              disabled={!canSendOtp}
              loading={loading}
              style={styles.authButton}
            />
          </View>
          </View>
        </View>
      </ScrollView>

      <CountryPickerModal
        visible={countryPickerVisible}
        selectedCode={country.code}
        onSelect={handleCountrySelect}
        onClose={() => setCountryPickerVisible(false)}
      />

      <PolicyModal
        visible={policyModal !== null}
        type={policyModal ?? "terms"}
        onClose={() => setPolicyModal(null)}
      />
    </KeyboardAvoidingView>
    </Pressable>
  );
}
