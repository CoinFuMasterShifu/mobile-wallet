import React from 'react';
import { View, Text } from 'react-native';
import FormattedNumber from '../FormattedNumber';
import { useNumberDisplay } from '../../contexts/NumberDisplayContext';
import { defiStyles } from './defiStyles';
import { theme } from '../../theme';

const withBorderAlpha = (hex: string, alpha = 0.6): string => {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return hex.length === 7 ? `${hex}${a}` : hex;
};

interface Props {
  lpBalance: string | null | undefined;
  assetName?: string;
}

const DexLpSharesCard: React.FC<Props> = ({ lpBalance, assetName = 'Pool' }) => {
  const { liquidityPoolStyles } = useNumberDisplay();

  if (lpBalance == null || lpBalance === '') return null;

  return (
    <View
      style={[
        defiStyles.lpSharesCard,
        {
          backgroundColor: liquidityPoolStyles.bgMuted,
          borderColor: withBorderAlpha(liquidityPoolStyles.border, 0.6),
        },
      ]}
    >
      <View style={defiStyles.row}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[defiStyles.lpSharesLabel, { color: liquidityPoolStyles.text }]}>YOUR LP SHARES</Text>
          <FormattedNumber value={lpBalance} variant="balance" style={[defiStyles.lpSharesValue, { color: theme.colors.textPrimary }]} />
        </View>
        <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <Text style={[defiStyles.poolHashHint, { color: liquidityPoolStyles.textMuted }]}>Redeemable in</Text>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: theme.typography.semiBold, fontSize: theme.typography.h4 }}>
            {assetName} pool
          </Text>
        </View>
      </View>
      <Text
        style={[
          defiStyles.lpSharesFooter,
          {
            color: liquidityPoolStyles.textMuted,
            borderTopColor: withBorderAlpha(liquidityPoolStyles.border, 0.35),
          },
        ]}
      >
        LP shares represent your pool ownership. Withdraw below to receive underlying asset + WART.
      </Text>
    </View>
  );
};

export default DexLpSharesCard;