import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';
import NumberDisplaySettings from './NumberDisplaySettings';
import { validateWarthogAddressInput } from '../../utils/warthogFormat';
import { defiColors, defiStyles } from '../defi/defiStyles';
import { theme } from '../../theme';

type ToolId = 'numbers' | 'validate';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const ToolsModal: React.FC<Props> = ({ visible, onClose }) => {
  const [activeTool, setActiveTool] = useState<ToolId>('numbers');
  const [address, setAddress] = useState('');
  const [validateResult, setValidateResult] = useState<ReturnType<typeof validateWarthogAddressInput> | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const toolOptions = useMemo(
    () => [
      { id: 'numbers' as const, label: 'Number Display' },
      { id: 'validate' as const, label: 'Validate Address' },
    ],
    []
  );

  const handleValidateAddress = () => {
    setIsValidating(true);
    try {
      setValidateResult(validateWarthogAddressInput(address));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      setValidateResult({ valid: false, error: message });
    }
    setIsValidating(false);
  };

  const copyAddress = (text: string) => {
    if (!text) return;
    Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Address copied to clipboard');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={defiStyles.modalOverlay}>
        <ScrollView
          style={defiStyles.modalContent}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={defiStyles.modalAccent} />
          <Text style={defiStyles.modalTitle}>Tools</Text>
          <Text style={styles.intro}>
            Utility helpers for display preferences and address checks — synced with wartbunker number
            display settings.
          </Text>

          <View style={styles.toolTabs}>
            {toolOptions.map((tool) => (
              <TouchableOpacity
                key={tool.id}
                style={[styles.toolTab, activeTool === tool.id && styles.toolTabActive]}
                onPress={() => setActiveTool(tool.id)}
              >
                <Text
                  style={[
                    styles.toolTabText,
                    activeTool === tool.id && styles.toolTabTextActive,
                  ]}
                >
                  {tool.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTool === 'numbers' ? (
            <View style={styles.toolPanel}>
              <NumberDisplaySettings />
            </View>
          ) : null}

          {activeTool === 'validate' ? (
            <View style={styles.toolPanel}>
              <Text style={styles.panelTitle}>Validate Address</Text>
              <Text style={styles.panelDesc}>
                Check a Warthog address locally — no node connection required.
              </Text>
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={(t) => setAddress(t.trim())}
                placeholder="Enter address"
                placeholderTextColor={defiColors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.actionBtn, (!address || isValidating) && styles.actionBtnDisabled]}
                onPress={handleValidateAddress}
                disabled={isValidating || !address}
              >
                {isValidating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionBtnText}>Validate Address</Text>
                )}
              </TouchableOpacity>

              {validateResult ? (
                <View
                  style={[
                    styles.resultBox,
                    validateResult.valid ? styles.resultOk : styles.resultErr,
                  ]}
                >
                  {validateResult.valid ? (
                    <>
                      <Text style={styles.resultOkText}>{validateResult.message}</Text>
                      <Text style={styles.resultMeta}>Address</Text>
                      <TouchableOpacity onPress={() => copyAddress(validateResult.fullAddress || '')}>
                        <Text style={styles.resultAddress}>{validateResult.fullAddress}</Text>
                      </TouchableOpacity>
                      <Text style={styles.resultHint}>Tap to copy</Text>
                    </>
                  ) : (
                    <Text style={styles.resultErrText}>{validateResult.error}</Text>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          <TouchableOpacity onPress={onClose}>
            <Text style={defiStyles.modalClose}>Close</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  intro: {
    color: defiColors.textMuted,
    fontSize: theme.typography.caption,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  toolTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  toolTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(39, 39, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(82, 82, 91, 0.5)',
  },
  toolTabActive: {
    backgroundColor: defiColors.goldHover,
    borderColor: defiColors.goldHover,
  },
  toolTabText: {
    color: defiColors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: theme.typography.semiBold,
  },
  toolTabTextActive: {
    color: '#fff',
  },
  toolPanel: {
    backgroundColor: defiColors.bgInset,
    borderWidth: 1,
    borderColor: defiColors.border,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  panelTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: theme.typography.semiBold,
    marginBottom: 4,
  },
  panelDesc: {
    color: defiColors.textMuted,
    fontSize: theme.typography.caption,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  inputLabel: {
    color: defiColors.textSecondary,
    fontSize: theme.typography.caption,
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: defiColors.bgCard,
    color: theme.colors.textPrimary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: defiColors.border,
    marginBottom: theme.spacing.md,
    fontSize: theme.typography.bodySm,
    fontFamily: theme.typography.fontFamily.mono,
  },
  actionBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: defiColors.goldHover,
    borderWidth: 1,
    borderColor: defiColors.goldHover,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: theme.typography.semiBold,
    fontSize: theme.typography.caption,
  },
  resultBox: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  resultOk: {
    borderColor: defiColors.border,
    backgroundColor: 'rgba(24, 24, 27, 0.6)',
  },
  resultErr: {
    borderColor: 'rgba(248, 113, 113, 0.4)',
    backgroundColor: 'rgba(127, 29, 29, 0.2)',
  },
  resultOkText: {
    color: defiColors.gold,
    fontWeight: theme.typography.semiBold,
    marginBottom: theme.spacing.sm,
  },
  resultMeta: {
    color: defiColors.textMuted,
    fontSize: 10,
    marginBottom: 4,
  },
  resultAddress: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.caption,
  },
  resultHint: {
    color: defiColors.textMuted,
    fontSize: 10,
    marginTop: theme.spacing.sm,
  },
  resultErrText: {
    color: '#f87171',
    fontSize: theme.typography.caption,
  },
});

export default ToolsModal;