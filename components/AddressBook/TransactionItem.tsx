import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAddressBook } from './AddressBookModal'; // adjust path if needed
import { Transaction } from '../../types';
import { colors, spacing, typography } from '../../theme';

interface TransactionItemProps {
  tx: Transaction;
  onPress?: () => void;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ tx, onPress }) => {
  const { getDisplayName, getContactByAddress, recordAddressUsage } = useAddressBook();

  const toDisplay = getDisplayName(tx.toAddress || '');
  const fromDisplay = getDisplayName(tx.fromAddress || '');

  const toContact = getContactByAddress(tx.toAddress);
  const fromContact = getContactByAddress(tx.fromAddress);

  // Auto-update usage count when user sees the transaction (great UX)
  useEffect(() => {
    if (toContact && tx.toAddress) recordAddressUsage(tx.toAddress);
    if (fromContact && tx.fromAddress) recordAddressUsage(tx.fromAddress);
  }, [toContact, fromContact, tx.toAddress, tx.fromAddress, recordAddressUsage]);

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toFixed(8);
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        <Text style={styles.label}>From</Text>
        <Text style={styles.value}>{fromDisplay}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>To</Text>
        <Text style={styles.value}>
          {toDisplay}
          {toContact && <Text style={styles.known}> ✓ known contact</Text>}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Amount</Text>
        <Text style={styles.amount}>{formatAmount(tx.amount)} WART</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Confirmations</Text>
        <Text style={styles.value}>{tx.confirmations}</Text>
      </View>

      {tx.timestamp && (
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>
            {new Date(tx.timestamp * 1000).toLocaleString()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  value: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontFamily: typography.fontFamily.mono,
  },
  known: {
    color: colors.primary,
    fontSize: typography.caption,
  },
  amount: {
    color: colors.success,
    fontWeight: 'bold',
  },
});
