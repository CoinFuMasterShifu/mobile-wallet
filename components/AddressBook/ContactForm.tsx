import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Contact, ContactFormData } from '../../types';
import { colors, spacing, typography } from '../../theme';
import { Input } from '../Input';
import { Button } from '../Button';
import {
  validateContactName,
  validateWarthogAddress,
  validateContactNotes
} from '../../utils/addressValidation';

type ContactFormMode = 'create' | 'edit';

interface ContactFormProps {
  mode: ContactFormMode;
  contact?: Contact;
  onSave: (data: ContactFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  initialAddress?: string;  // Pre-populate from transaction
}

export const ContactForm: React.FC<ContactFormProps> = ({
  mode,
  contact,
  onSave,
  onCancel,
  isLoading = false,
  initialAddress = '',
}) => {
  const [formData, setFormData] = useState<ContactFormData>({
    name: contact?.name || '',
    address: contact?.address || initialAddress,
    notes: contact?.notes || '',
    isFavorite: contact?.isFavorite || false,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof ContactFormData, boolean>>>({});

  // Real-time validation
  useEffect(() => {
    const newErrors: Partial<Record<keyof ContactFormData, string>> = {};

    // Validate name
    const nameValidation = validateContactName(formData.name);
    if (!nameValidation.isValid) {
      newErrors.name = nameValidation.error;
    }

    // Validate address
    const addressValidation = validateWarthogAddress(formData.address);
    if (!addressValidation.isValid) {
      newErrors.address = addressValidation.error;
    }

    // Validate notes
    const notesValidation = validateContactNotes(formData.notes);
    if (!notesValidation.isValid) {
      newErrors.notes = notesValidation.error;
    }

    setErrors(newErrors);
  }, [formData]);

  const handleFieldChange = (field: keyof ContactFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async () => {
    // Mark all fields as touched for validation display
    setTouched({
      name: true,
      address: true,
      notes: true,
    });

    // Check if there are any errors
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await onSave(formData);
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  const canSubmit = formData.name.trim() && formData.address.trim();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.title}>
          {mode === 'create' ? 'Add Contact' : 'Edit Contact'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'create'
            ? 'Save wallet addresses for easy access'
            : 'Update contact information'
          }
        </Text>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <Input
            label="Contact Name"
            placeholder="Enter contact name"
            value={formData.name}
            onChangeText={(value) => handleFieldChange('name', value)}
            error={touched.name ? errors.name : undefined}
            autoCapitalize="words"
            autoFocus={mode === 'create'}
          />

          <Input
            label="Wallet Address"
            placeholder="0x..."
            value={formData.address}
            onChangeText={(value) => handleFieldChange('address', value)}
            error={touched.address ? errors.address : undefined}
            autoCapitalize="none"
            autoCorrect={false}
            multiline={false}
          />

          <Input
            label="Notes (Optional)"
            placeholder="Add notes about this contact"
            value={formData.notes || ''}
            onChangeText={(value) => handleFieldChange('notes', value)}
            error={touched.notes ? errors.notes : undefined}
            multiline={true}
            numberOfLines={3}
          />

          <View style={styles.favoriteContainer}>
            <Text style={styles.favoriteLabel}>Favorite</Text>
            <Button
              title={formData.isFavorite ? '★ Favorited' : '☆ Add to Favorites'}
              variant={formData.isFavorite ? 'primary' : 'outline'}
              size="small"
              onPress={() => handleFieldChange('isFavorite', !formData.isFavorite)}
            />
          </View>
        </View>
      </ScrollView>
<View style={styles.actions}>
  <Button
    title="Cancel"
    variant="ghost"
    size="medium"
    onPress={onCancel}
    disabled={isLoading}
    style={{ flex: 1 }}
  />
  <Button
    title={mode === 'create' ? 'Add Contact' : 'Save Changes'}
    variant="primary"
    size="medium"
    onPress={handleSubmit}
    disabled={!canSubmit || isLoading}
    loading={isLoading}
    style={{ flex: 1 }}
  />
</View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  scrollContainer: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },

  header: {
    marginBottom: spacing.xl,
  },

  title: {
    color: colors.textPrimary,
    fontSize: typography.h2,
    fontWeight: typography.bold,
    marginBottom: spacing.sm,
  },

  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
  },

  form: {
    marginBottom: spacing.xl,
  },

  favoriteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  favoriteLabel: {
    color: colors.textSecondary,
    fontSize: typography.body,
    fontWeight: typography.medium,
  },

actions: {
  flexDirection: 'row',
  gap: spacing.md,
  padding: spacing.lg,
  paddingBottom: Platform.OS === 'ios' ? 34 : spacing.lg, // safe area
  borderTopWidth: 1,
  borderTopColor: colors.border,
  backgroundColor: colors.surface,
},
});
