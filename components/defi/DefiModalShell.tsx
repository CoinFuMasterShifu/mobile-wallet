import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleProp, ViewStyle } from 'react-native';
import { defiStyles } from './defiStyles';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  showClose?: boolean;
}

const DefiModalShell: React.FC<Props> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  contentStyle,
  showClose = true,
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={defiStyles.modalOverlay}>
      <ScrollView
        style={[defiStyles.modalContent, contentStyle]}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
        <View style={defiStyles.modalAccent} />
        <View style={defiStyles.modalHeader}>
          <Text style={defiStyles.modalTitle}>{title}</Text>
          {subtitle ? <Text style={defiStyles.modalSubtitle}>{subtitle}</Text> : null}
        </View>
        {children}
        {showClose ? (
          <TouchableOpacity onPress={onClose}>
            <Text style={defiStyles.modalClose}>Close</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  </Modal>
);

export default DefiModalShell;