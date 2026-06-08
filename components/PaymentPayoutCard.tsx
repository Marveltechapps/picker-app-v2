import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";

type BankCardDetails = {
  accountHolder: string;
  accountNumber: string;
  bankName?: string;
  ifscCode: string;
};

type UpiCardDetails = {
  accountHolder: string;
  upiId: string;
};

type PaymentPayoutCardProps =
  | { variant: "bank"; details: BankCardDetails }
  | { variant: "upi"; details: UpiCardDetails };

function maskAccountNumber(accountNumber: string) {
  const digits = accountNumber.replace(/\D/g, "");
  const last4 = digits.slice(-4) || accountNumber.slice(-4);
  return `•••• •••• ${last4}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function PaymentPayoutCard(props: PaymentPayoutCardProps) {
  const isBank = props.variant === "bank";

  return (
    <View style={[styles.methodCard, isBank ? styles.methodCardBank : styles.methodCardUpi]}>
      <View style={styles.methodCardHeader}>
        <Text style={styles.methodCardTitle}>
          {isBank ? "Bank Account Details" : "UPI Details"}
        </Text>
        <View style={styles.verifiedBadge}>
          <Check size={10} color="#FFFFFF" strokeWidth={3} />
          <Text style={styles.verifiedText}>Verified</Text>
        </View>
      </View>

      {isBank ? (
        <>
          <DetailRow label="Account holder name" value={props.details.accountHolder} />
          <DetailRow
            label="Account number"
            value={maskAccountNumber(props.details.accountNumber)}
          />
          <DetailRow label="Bank name" value={props.details.bankName?.trim() || "—"} />
          <DetailRow label="IFSC code" value={props.details.ifscCode} />
        </>
      ) : (
        <>
          <DetailRow label="Account holder name" value={props.details.accountHolder} />
          <DetailRow label="UPI ID" value={props.details.upiId} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  methodCard: {
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 12,
    overflow: "hidden",
    alignSelf: "stretch",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  methodCardBank: {
    backgroundColor: "#155DFC",
    shadowColor: "#155DFC",
  },
  methodCardUpi: {
    backgroundColor: "#32C96A",
    shadowColor: "#32C96A",
  },
  methodCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  methodCardTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
    flex: 1,
    minWidth: 0,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 21,
    flexShrink: 0,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    color: "#FFFFFF",
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    color: "rgba(255, 255, 255, 0.85)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontSize: 11,
    fontWeight: "600",
  },
  detailValue: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 20,
  },
});
