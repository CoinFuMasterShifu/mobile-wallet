import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { defiColors, defiStyles } from './defiStyles';
import DefiModalShell from './DefiModalShell';
import QrScannerModal from '../QrScannerModal';
import { isValidAssetHash } from '../../utils/warthogFormat';
import { isValidAddress } from '../../utils/crypto';
import { submitAssetTransfer } from '../../utils/defiSubmit';
import { DEFAULT_FEE } from '../../constants';
import type { AssetPrefill, WalletData } from '../../types';
import { theme } from '../../theme';

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
  const [balance, setBalance] = useState('');
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
    setBalance(prefill.balance || '');
    setAmount('');
    onPrefillConsumed();
  }, [prefill, onPrefillConsumed]);

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

    const nonceId = manualNonce ? parseInt(manualNonce, 10) : nextNonce;
    setSending(true);
    try {
      const result = await submitAssetTransfer({
        node: selectedNode,
        wallet,
        nonceId,
        fee,
        assetHash,
        toAddress: recipient,
        amount,
        decimals: parseInt(decimals, 10) || 8,
        isLiquidity,
      });
      await onSuccess(result.nonce + 1);
      Alert.alert('Sent', `Tx: ${result.txHash.slice(0, 20)}…`);
      setRecipient('');
      setAmount('');
      setManualNonce('');
      onClose();
    } catch (e: any) {
      Alert.alert('Transfer failed', e.message);
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
          <Text style={defiStyles.label}>Amount {balance ? `(balance: ${balance})` : ''}</Text>
          <TextInput style={defiStyles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={theme.colors.textMuted} />
          {balance ? (
            <TouchableOpacity style={[defiStyles.btn, defiStyles.btnSecondary]} onPress={() => setAmount(balance)}>
              <Text style={defiStyles.btnTextSecondary}>Max</Text>
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