import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView, Animated } from "react-native";
import { useRouter } from "expo-router";
import { User } from "lucide-react-native";
import { useAuth } from "@/state/authContext";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { updateProfileApi, getProfileApi } from "@/services/user.service";
import Header from "@/components/Header";
import ProfileAvatarUploader from "@/components/ProfileAvatarUploader";
import RadioGroup from "@/components/RadioGroup";
import PrimaryButton from "@/components/PrimaryButton";
import { appNotify } from "@/utils/appNotify";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export default function UserProfileScreen() {
  const router = useRouter();
  const { completeProfile, userProfile } = useAuth();
  const { refresh: refreshOnboardingState } = useOnboardingState();
  const [name, setName] = useState<string>("");
  const [age, setAge] = useState<string>("");
  const [gender, setGender] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Pre-fill from existing profile (local storage or API) when profile was already completed
  useEffect(() => {
    const fillFromProfile = (profile: { name?: string; age?: number; gender?: string; photoUri?: string } | null) => {
      if (!profile) return;
      if (profile.name?.trim()) setName(profile.name.trim());
      if (typeof profile.age === "number" && profile.age >= 1 && profile.age <= 120) setAge(String(profile.age));
      if (profile.gender === "male" || profile.gender === "female") setGender(profile.gender);
      if (profile.photoUri?.trim()) setPhotoUri(profile.photoUri.trim());
    };
    // First try local userProfile (AsyncStorage)
    fillFromProfile(userProfile ?? null);
    // Then fetch from API in case backend has more complete data
    let cancelled = false;
    (async () => {
      try {
        const data = await getProfileApi();
        if (cancelled || !data) return;
        fillFromProfile({
          name: data.name,
          age: typeof data.age === "number" ? data.age : undefined,
          gender: data.gender,
          photoUri: data.photoUri,
        });
      } catch {
        // Non-blocking: local data already applied
      }
    })();
    return () => { cancelled = true; };
  }, [userProfile]);

  const handleAgeChange = (text: string) => {
    const numeric = text.replace(/[^0-9]/g, "");
    if (numeric === "") {
      setAge(numeric);
      return;
    }
    try {
      const ageNum = parseInt(numeric, 10);
      if (!isNaN(ageNum) && ageNum >= 1 && ageNum <= 120) {
        setAge(numeric);
      }
    } catch {
      // Invalid input, ignore
    }
  };

  const handleContinue = async () => {
    try {
      const ageNum = parseInt(age, 10);
      if (!photoUri || name.length < 2 || isNaN(ageNum) || ageNum < 1 || ageNum > 120 || !gender) return;
      setLoading(true);
      const profilePayload = { name, age: ageNum, gender: gender as "male" | "female", photoUri };
      const apiResult = await updateProfileApi(profilePayload);
      if (!apiResult.success) {
        appNotify.error(apiResult.error || "Failed to save profile. You can try again from Edit Profile.");
      }
      await completeProfile(profilePayload);
      await refreshOnboardingState();
      setLoading(false);
      router.replace("/documents");
    } catch (error) {
      setLoading(false);
      const ageNum = parseInt(age, 10);
      if (!isNaN(ageNum) && photoUri && gender) {
        await completeProfile({ name, age: ageNum, gender: gender as "male" | "female", photoUri });
        await refreshOnboardingState();
        router.replace("/documents");
      }
    }
  };

  const isValid = (() => {
    try {
      const ageNum = parseInt(age, 10);
      return photoUri !== null && name.length >= 2 && age !== "" && !isNaN(ageNum) && ageNum >= 1 && ageNum <= 120 && gender !== null;
    } catch {
      return false;
    }
  })();

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <Header
        title="Complete Profile"
        subtitle="Add your personal information"
        onBackPress={() => {
          try {
            if (router.canGoBack()) router.back();
            else router.push("/login");
          } catch {
            try { router.push("/login"); } catch { /* fallback */ }
          }
        }}
      />
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <ProfileAvatarUploader 
            photoUri={photoUri}
            onPhotoSelected={setPhotoUri}
          />

          <View style={styles.inputSection}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Full Name</Text>
              <Text style={styles.required}>*</Text>
            </View>
            <View style={styles.inputWrapper}>
              <User color="#9CA3AF" size={20} strokeWidth={2} style={styles.inputIcon} />
              <TextInput
                style={styles.inputWithIcon}
                placeholder="John Doe"
                placeholderTextColor="#D1D5DB"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputSection}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Age</Text>
              <Text style={styles.required}>*</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="25"
              placeholderTextColor="#D1D5DB"
              value={age}
              onChangeText={handleAgeChange}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>

          <View style={styles.inputSection}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Gender</Text>
              <Text style={styles.required}>*</Text>
            </View>
            <RadioGroup 
              options={GENDER_OPTIONS}
              selectedValue={gender}
              onSelect={setGender}
            />
          </View>

          <View style={styles.buttonContainer}>
            <Animated.View style={{ opacity: isValid ? 1 : 0.5 }}>
              <PrimaryButton 
                title="Continue" 
                onPress={handleContinue} 
                disabled={!isValid}
                loading={loading}
              />
            </Animated.View>
          </View>
        </View>
      </ScrollView>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
  },
  content: {
    paddingHorizontal: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  required: {
    fontSize: 15,
    fontWeight: "600",
    color: "#EF4444",
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  inputWithIcon: {
    flex: 1,
    paddingVertical: 18,
    fontSize: 17,
    fontWeight: "500",
    color: "#111827",
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontSize: 17,
    fontWeight: "500",
    color: "#111827",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 20,
  },
});
