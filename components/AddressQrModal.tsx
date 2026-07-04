import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import DefiModalShell from './defi/DefiModalShell';
import { defiColors, defiStyles } from './defi/defiStyles';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  address: string;
  onClose: () => void;
  onCopy?: (address: string) => void;
}

const AddressQrModal: React.FC<Props> = ({ visible, address, onClose, onCopy }) => (
  <DefiModalShell
    visible={visible}
    onClose={onClose}
    title="Receive WART"
    subtitle="Let a peer scan this QR code to get your wallet address"
    contentStyle={{ maxHeight: '88%' }}
  >
    <View style={styles.qrWrap}>
      <QRCode value={address} size={200} />
    </View>

    <Text style={styles.address} selectable>
      {address}
    </Text>

    {onCopy ? (
      <TouchableOpacity style={[defiStyles.btn, defiStyles.btnSecondary]} onPress={() => onCopy(address)}>
        <Text style={defiStyles.btnTextSecondary}>Copy Address</Text>
      </TouchableOpacity>
    ) : null}
  </DefiModalShell>
);

const styles = StyleSheet.create({
  qrWrap: {
    alignSelf: 'center',
    padding: theme.spacing.md,
    backgroundColor: '#fff',
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  address: {
    color: defiColors.textSecondary,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.mono,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
});

export default AddressQrModal;