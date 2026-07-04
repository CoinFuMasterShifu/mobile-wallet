import React from 'react';
import { View, ScrollView, TouchableOpacity, Text } from 'react-native';
import { defiStyles } from './defiStyles';

export interface DefiNavTab {
  id: string;
  label: string;
  onPress: () => void;
}

interface Props {
  tabs: DefiNavTab[];
  activeId?: string | null;
}

const DefiNavTabs: React.FC<Props> = ({ tabs, activeId }) => (
  <View style={defiStyles.tabBar}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={defiStyles.tabBarScroll}
    >
      {tabs.map((tab) => {
        const isActive = activeId === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[defiStyles.tabBarBtn, isActive && defiStyles.tabBarBtnActive]}
            onPress={tab.onPress}
          >
            <Text style={defiStyles.tabBarBtnText}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
);

export default DefiNavTabs;