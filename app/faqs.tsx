import { ScrollView } from "@/utils/scrollables";
import { TouchableOpacity } from "@/utils/touchables";
import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TextInput, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, ChevronDown, ChevronUp } from "lucide-react-native";
import { useRouter } from "expo-router";
import Header from "@/components/Header";
import { getFaqs } from "@/services/faq.service";

interface FAQ {
  id: string;
  category: string;
  categoryColor: string;
  question: string;
  answer: string;
}

export default function FAQsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getFaqs()
      .then((list) => {
        if (!cancelled) {
          const mapped = list.map((f) => ({
            id: f.id,
            category: f.category ?? "",
            categoryColor: "#121358",
            question: f.question,
            answer: f.answer,
          }));
          setFaqs(mapped);
          if (mapped.length > 0) {
            setExpandedId(mapped[0].id);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setFaqs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredFAQs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header title="FAQs" subtitle="Find answers quickly" />

      {loading ? (
        <View style={{ padding: 24, alignItems: "center" }}>
          <ActivityIndicator size="large" />
        </View>
      ) : null}

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search color="#9CA3AF" size={20} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search questions..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredFAQs.map((faq) => (
          <TouchableOpacity
            key={faq.id}
            style={styles.faqCard}
            activeOpacity={0.7}
            onPress={() => toggleExpand(faq.id)}
          >
            <View style={styles.faqHeader}>
              <View style={styles.faqContent}>
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: `${faq.categoryColor}20` },
                  ]}
                >
                  <Text
                    style={[styles.categoryText, { color: faq.categoryColor }]}
                  >
                    {faq.category}
                  </Text>
                </View>
                <Text style={styles.questionText}>{faq.question}</Text>
              </View>
              {expandedId === faq.id ? (
                <ChevronUp color="#9CA3AF" size={20} strokeWidth={2} />
              ) : (
                <ChevronDown color="#9CA3AF" size={20} strokeWidth={2} />
              )}
            </View>

            {expandedId === faq.id && (
              <Text style={styles.answerText}>{faq.answer}</Text>
            )}
          </TouchableOpacity>
        ))}

        {filteredFAQs.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {faqs.length === 0 ? "No FAQs at the moment" : "No FAQs found"}
            </Text>
            <Text style={styles.emptySubtext}>
              {faqs.length === 0
                ? "No questions yet"
                : "Try searching with different keywords"}
            </Text>
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "400" as const,
    color: "#111827",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  faqCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...(Platform.OS === 'web' 
      ? { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)', elevation: 2 }
      : { shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }
    ),
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  faqContent: {
    flex: 1,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  questionText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#111827",
    lineHeight: 22,
  },
  answerText: {
    fontSize: 14,
    fontWeight: "400" as const,
    color: "#6B7280",
    lineHeight: 20,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#111827",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: "400" as const,
    color: "#9CA3AF",
  },
  bottomSpacer: {
    height: 20,
  },
});
