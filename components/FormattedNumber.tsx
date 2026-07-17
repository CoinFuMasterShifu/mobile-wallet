import React from 'react';
import { Text, TextStyle } from 'react-native';
import { useNumberDisplay } from '../contexts/NumberDisplayContext';
import { theme } from '../theme';

interface Props {
  value: unknown;
  variant?: 'number' | 'balance';
  overrides?: { fallback?: string; maxDecimals?: number | null };
  style?: TextStyle | TextStyle[] | (TextStyle | undefined)[];
}

const FormattedNumber: React.FC<Props> = ({
  value,
  variant = 'number',
  overrides,
  style,
}) => {
  const { formatNumber, formatBalance, numberColor, balanceColor } = useNumberDisplay();
  const text = variant === 'balance' ? formatBalance(value, overrides) : formatNumber(value, overrides);
  const color = variant === 'balance' ? balanceColor : numberColor;

  return (
    <Text
      style={[
        { fontFamily: theme.typography.fontFamily.mono },
        style,
        { color },
      ]}
    >
      {text}
    </Text>
  );
};

export default FormattedNumber;