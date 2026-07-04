import React from 'react';
import { View, Text } from 'react-native';
import { defiStyles } from './defiStyles';

interface Props {
  title?: string;
  subtitle?: string;
}

const DefiPageHeader: React.FC<Props> = ({
  title = 'Wallet Overview',
  subtitle = 'Your balances, assets, and open orders',
}) => (
  <View style={defiStyles.pageHeader}>
    <Text style={defiStyles.pageTitle}>{title}</Text>
    <Text style={defiStyles.pageSubtitle}>{subtitle}</Text>
  </View>
);

export default DefiPageHeader;