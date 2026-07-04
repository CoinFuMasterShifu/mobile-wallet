import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { defiStyles } from './defiStyles';
import FormattedNumber from '../FormattedNumber';
import type { WalletData } from '../../types';
import { theme } from '../../theme';

interface Props {
  wallet: WalletData;
  currentWalletName?: string;
  balance: string;
  usdBalance: string;
  nodeLabel: string;
  networkLabel?: string;
  refreshing?: boolean;
  onRefresh: () => void;
  onSendWart: () => void;
  onShowAddressQr: () => void;
  onCopyAddress: (address: string) => void;
}

const DefiBalanceHero: React.FC<Props> = ({
  wallet,
  currentWalletName,
  balance,
  usdBalance,
  nodeLabel,
  networkLabel = 'DeFi Testnet',
  refreshing,
  onRefresh,
  onSendWart,
  onShowAddressQr,
  onCopyAddress,
}) => (
  <View style={defiStyles.hero}>
    <View style={defiStyles.heroBody}>
      {currentWalletName ? (
        <View style={defiStyles.heroWalletLabel}>
          <View style={defiStyles.heroWalletDot} />
          <Text style={defiStyles.heroWalletText}>
            Saved as <Text style={defiStyles.heroWalletName}>{currentWalletName}</Text>
          </Text>
        </View>
      ) : null}

      <View style={defiStyles.heroTopRow}>
        <Text style={defiStyles.heroLabel}>Total Balance</Text>
        <TouchableOpacity style={defiStyles.heroRefreshBtn} onPress={onRefresh} disabled={refreshing}>
          {refreshing ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={defiStyles.heroRefreshIcon}>⟳</Text>
          )}
          <Text style={defiStyles.heroRefreshText}>{refreshing ? 'Refreshing…' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>

      <View style={defiStyles.heroBalanceRow}>
        <FormattedNumber value={balance} variant="balance" style={defiStyles.heroBalance} />
        <Text style={defiStyles.heroBalanceUnit}>WART</Text>
      </View>
      <Text style={defiStyles.heroUsd}>
        ≈ <FormattedNumber value={usdBalance} variant="number" /> USD
      </Text>
      <Text style={defiStyles.heroNode}>{nodeLabel} • {networkLabel}</Text>

      <View style={defiStyles.heroActions}>
        <TouchableOpacity style={defiStyles.heroSendBtn} onPress={onSendWart}>
          <Text style={defiStyles.heroSendBtnText}>Send WART</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={defiStyles.heroIconBtn}
          onPress={onShowAddressQr}
          accessibilityLabel="Show address QR code"
        >
          <Text style={defiStyles.heroIconBtnText}>QR</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => onCopyAddress(wallet.address)}>
          <Text style={defiStyles.heroAddress} numberOfLines={1}>
            {wallet.address.slice(0, 10)}…{wallet.address.slice(-8)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

export default DefiBalanceHero;