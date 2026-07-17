import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { defiColors, defiStyles } from './defiStyles';
import DefiModalShell from './DefiModalShell';
import SpendableBalanceDisplay from '../SpendableBalanceDisplay';
import QrScannerModal from '../QrScannerModal';
import {
  amountExceedsAvailable,
  insufficientFreeBalanceMessage,
  isValidAssetHash,
  normalizeAssetHash,
} from '../../utils/warthogFormat';
import { isValidAddress } from '../../utils/crypto';
import { fetchAssetBalanceForAddress } from '../../utils/defiApi';
import { submitAssetTransfer } from '../../utils/defiSubmit';
import { DEFAULT_FEE } from '../../constants';
import type { AssetPrefill, WalletData } from '../../types';
import { theme } from '../../theme';

type Spendable = {
  available: string;
  locked: string;
  total: string;
  hasLocked: boolean;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  wallet: WalletData;
  selectedNode: string;
  nextNonce: number;
  prefill: AssetPrefill | null;
  onPrefillConsumed: () => void;
  onSuccess: (nonce: number) => Promise<void>;
}

const SendAssetModal: React.FC<Props> = ({
  visible,
  onClose,
  wallet,
  selectedNode,
  nextNonce,
  prefill,
  onPrefillConsumed,
  onSuccess,
}) => {
  const [assetHash, setAssetHash] = useState('');
  const [assetName, setAssetName] = useState('');
  const [decimals, setDecimals] = useState('8');
  const [spendable, setSpendable] = useState<Spendable>({
    available: '',
    locked: '0',
    total: '',
    hasLocked: false,
  });
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState(DEFAULT_FEE);
  const [isLiquidity, setIsLiquidity] = useState(false);
  const [manualNonce, setManualNonce] = useState('');
  const [sending, setSending] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);

  useEffect(() => {
    if (!prefill) return;
    setAssetHash(prefill.hash || '');
    setAssetName(prefill.name || '');
    setDecimals(String(prefill.decimals ?? 8));
    const available = prefill.available ?? prefill.balance ?? '';
    const locked = prefill.locked ?? '0';
    const total = prefill.total ?? prefill.balance ?? available;
    setSpendable({
      available,
      locked,
      total,
      hasLocked: parseFloat(locked || '0') > 0,
    });
    setAmount('');
    onPrefillConsumed();
  }, [prefill, onPrefillConsumed]);

  const loadAssetBalance = useCallback(
    async (hashRaw: string, { silent = false } = {}): Promise<Spendable | null> => {
      if (!wallet?.address || !selectedNode) return null;
      const hash = normalizeAssetHash(hashRaw);
      if (!isValidAssetHash(hash)) return null;

      if (!silent) setBalanceLoading(true);
      try {
        const bal = await fetchAssetBalanceForAddress(
          selectedNode,
          wallet.address,
          hash,
          assetName
        );
        const next: Spendable = {
          available: bal.available,
          locked: bal.locked,
          total: bal.balance,
          hasLocked: Boolean(bal.hasLocked),
        };
        setSpendable(next);
        if (bal.name) setAssetName(bal.name);
        setDecimals(String(bal.decimals));
        return next;
      } catch (err: any) {
        if (!silent) Alert.alert('Balance', err.message || 'Could not load asset balance');
        return null;
      } finally {
        if (!silent) setBalanceLoading(false);
      }
    },
    [wallet?.address, selectedNode, assetName]
  );

  // Live refresh when hash is complete
  useEffect(() => {
    if (!visible) return;
    const hash = normalizeAssetHash(assetHash);
    if (!wallet?.address || !isValidAssetHash(hash)) return undefined;
    const t = setTimeout(() => {
      loadAssetBalance(hash, { silent: true });
    }, 300);
    return () => clearTimeout(t);
  }, [visible, assetHash, wallet?.address, selectedNode, loadAssetBalance]);

  const freeBalance = spendable.available || spendable.total || '';

  const handleMaxAmount = () => {
    if (freeBalance && freeBalance !== '0') {
      setAmount(freeBalance);
    }
  };

  const handleSend = async () => {
    if (!assetHash || !recipient || !amount) {
      Alert.alert('Missing fields', 'Asset hash, recipient, and amount are required');
      return;
    }
    if (!isValidAssetHash(assetHash)) {
      Alert.alert('Invalid hash', 'Asset hash must be 64 hex characters');
      return;
    }
    if (!isValidAddress(recipient.trim())) {
      Alert.alert('Invalid address', 'Recipient must be a valid 48-char address');
      return;
    }

    const amountStr = amount.trim();
    const nonceId = manualNonce ? parseInt(manualNonce, 10) : nextNonce;
    setSending(true);
    try {
      // Live free-balance check — locked tokens cannot be transferred
      const live = (await loadAssetBalance(assetHash, { silent: true })) || spendable;
      if (live?.available != null && amountExceedsAvailable(amountStr, live.available)) {
        const unit = assetName || 'tokens';
        const msg = insufficientFreeBalanceMessage({
          available: live.available,
          locked: live.locked,
          unit,
        });
        setAmount(live.available);
        Alert.alert('Insufficient free balance', msg);
        return;
      }

      const result = await submitAssetTransfer({
        node: selectedNode,
        wallet,
        nonceId,
        fee,
        assetHash,
        toAddress: recipient,
        amount: amountStr,
        decimals: parseInt(decimals, 10) || 8,
        isLiquidity,
      });
      await onSuccess(result.nonce + 1);
      Alert.alert('Sent', `Tx: ${result.txHash.slice(0, 20)}…`);
      setRecipient('');
      setAmount('');
      setManualNonce('');
      loadAssetBalance(assetHash, { silent: true });
      onClose();
    } catch (e: any) {
      let message = e.message || 'Transfer failed';
      if (/insufficient\s+(token\s+)?balance/i.test(message)) {
        message = insufficientFreeBalanceMessage({
          available: spendable.available,
          locked: spendable.locked,
          unit: assetName || 'tokens',
        });
      }
      Alert.alert('Transfer failed', message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
    <DefiModalShell
      visible={visible}
      onClose={onClose}
      title="Send Asset"
      subtitle={assetName ? `Transferring ${assetName}` : 'Send tokens or LP shares on the DeFi testnet'}
    >
          {assetName ? <Text style={defiStyles.label}>Asset: {assetName}</Text> : null}
          <Text style={defiStyles.label}>Asset Hash (64 hex)</Text>
          <TextInput style={defiStyles.input} value={assetHash} onChangeText={setAssetHash} placeholderTextColor={theme.colors.textMuted} autoCapitalize="none" />

          {balanceLoading ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginBottom: theme.spacing.sm }} />
          ) : freeBalance ? (
            <SpendableBalanceDisplay
              available={spendable.available || freeBalance}
              locked={spendable.locked}
              total={spendable.total || freeBalance}
              unit={assetName || 'tokens'}
              label="Available balance"
              layout="stack"
            />
          ) : null}

          <Text style={defiStyles.label}>Recipient Address</Text>
          <View style={localStyles.addressRow}>
            <TextInput
              style={[defiStyles.input, localStyles.addressInput]}
              value={recipient}
              onChangeText={setRecipient}
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
            />
            <TouchableOpacity style={localStyles.scanBtn} onPress={() => setShowQrScanner(true)}>
              <Text style={localStyles.scanBtnText}>📷</Text>
            </TouchableOpacity>
          </View>
          <Text style={defiStyles.label}>Amount</Text>
          <TextInput style={defiStyles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={theme.colors.textMuted} />
          {freeBalance ? (
            <TouchableOpacity style={[defiStyles.btn, defiStyles.btnSecondary]} onPress={handleMaxAmount}>
              <Text style={defiStyles.btnTextSecondary}>Use available</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={defiStyles.label}>Decimals</Text>
          <TextInput style={defiStyles.input} value={decimals} onChangeText={setDecimals} keyboardType="number-pad" placeholderTextColor={theme.colors.textMuted} />
          <TouchableOpacity
            style={[defiStyles.row, { marginBottom: theme.spacing.sm }]}
            onPress={() => setIsLiquidity(!isLiquidity)}
          >
            <View style={{
              width: 20,
              height: 20,
              borderWidth: 1,
              borderColor: defiColors.border,
              borderRadius: 4,
              backgroundColor: isLiquidity ? defiColors.goldHover : 'transparent',
              marginRight: 8,
            }} />
            <Text style={{ color: defiColors.textSecondary }}>Transfer LP shares (liquidity)</Text>
          </TouchableOpacity>
          <Text style={defiStyles.label}>Fee (WART)</Text>
          <TextInput style={defiStyles.input} value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholderTextColor={theme.colors.textMuted} />
          <Text style={defiStyles.label}>Nonce (auto: {nextNonce})</Text>
          <TextInput style={defiStyles.input} value={manualNonce} onChangeText={setManualNonce} keyboardType="number-pad" placeholder="Optional" placeholderTextColor={theme.colors.textMuted} />
          <TouchableOpacity style={defiStyles.btn} onPress={handleSend} disabled={sending}>
            <Text style={defiStyles.btnText}>{sending ? 'Sending…' : 'Send Asset'}</Text>
          </TouchableOpacity>
    </DefiModalShell>

    <QrScannerModal
      visible={showQrScanner}
      onClose={() => setShowQrScanner(false)}
      onScan={setRecipient}
    />
    </>
  );
};

const localStyles = StyleSheet.create({
  addressRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  addressInput: {
    flex: 1,
    marginBottom: 0,
  },
  scanBtn: {
    width: 50,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 39, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(82, 82, 91, 0.5)',
  },
  scanBtnText: {
    fontSize: 20,
  },
});

export default SendAssetModal;
