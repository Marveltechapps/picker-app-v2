import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";

interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  options: RadioOption[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
}

export default function RadioGroup({ options, selectedValue, onSelect }: RadioGroupProps) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isSelected = selectedValue === option.value;
        
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.radioButton, isSelected && styles.radioButtonSelected]}
            onPress={() => onSelect(option.value)}
            activeOpacity={0.7}
          >
            <View style={styles.radioOuter}>
              {isSelected && (
                <Animated.View style={styles.radioInner} />
              )}
            </View>
            <Text style={[styles.radioLabel, isSelected && styles.radioLabelSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 12,
  },
  radioButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  radioButtonSelected: {
    backgroundColor: "#F5F3FF",
    borderColor: "#8B5CF6",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#8B5CF6",
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
  },
  radioLabelSelected: {
    color: "#8B5CF6",
    fontWeight: "600",
  },
});
