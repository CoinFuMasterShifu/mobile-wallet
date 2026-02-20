import React, { useState, useCallback } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Contact } from '../../types';
import { colors, spacing, typography } from '../../theme';
import { ContactItem } from './ContactItem';

type ContactListMode = 'display' | 'select' | 'manage';

interface ContactListProps {
  contacts: Contact[];
  mode?: ContactListMode;
  onSelectContact?: (contact: Contact) => void;
  onEditContact?: (contact: Contact) => void;
  onDeleteContact?: (contact: Contact) => void;
  onToggleFavorite?: (contact: Contact) => void;
  onRefresh?: () => Promise<void>;
  emptyMessage?: string;
  showSearch?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const ContactList: React.FC<ContactListProps> = ({
  contacts,
  mode = 'display',
  onSelectContact,
  onEditContact,
  onDeleteContact,
  onToggleFavorite,
  onRefresh,
  emptyMessage = "No contacts yet",
  showSearch = false,
  searchQuery = '',
  onSearchChange,
}) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;

    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const renderSearchBar = () => {
    if (!showSearch) return null;

    return (
      <View style={styles.searchContainer}>
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => {
            // This would typically open a search modal or focus a text input
            // For now, we'll just show a placeholder
          }}
        >
          <Text style={styles.searchPlaceholder}>
            {searchQuery ? `Search: "${searchQuery}"` : 'Search contacts...'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📇</Text>
      <Text style={styles.emptyTitle}>No Contacts</Text>
      <Text style={styles.emptyMessage}>{emptyMessage}</Text>

      {mode === 'manage' && (
        <TouchableOpacity style={styles.emptyAction}>
          <Text style={styles.emptyActionText}>Add your first contact</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSectionHeader = ({ section }: any) => {
    if (!section.title) return null;

    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        {section.count && (
          <Text style={styles.sectionCount}>({section.count})</Text>
        )}
      </View>
    );
  };

  const getSectionsData = () => {
    // Group contacts by categories for better UX
    const favorites = contacts.filter(c => c.isFavorite);
    const recent = contacts
      .filter(c => !c.isFavorite && c.lastUsed)
      .sort((a, b) => (b.lastUsed!.getTime() - a.lastUsed!.getTime()))
      .slice(0, 5);
    const others = contacts.filter(c =>
      !c.isFavorite && !recent.some(r => r.id === c.id)
    );

    const sections = [];

    if (favorites.length > 0) {
      sections.push({
        title: 'Favorites',
        data: favorites,
        count: favorites.length,
      });
    }

    if (recent.length > 0 && mode !== 'manage') {
      sections.push({
        title: 'Recent',
        data: recent,
        count: recent.length,
      });
    }

    if (others.length > 0) {
      sections.push({
        title: mode === 'manage' ? 'All Contacts' : 'Contacts',
        data: others,
        count: others.length,
      });
    }

    return sections;
  };

  const renderContactItem = ({ item }: { item: Contact }) => (
    <ContactItem
      contact={item}
      mode={mode}
      onSelect={onSelectContact}
      onEdit={onEditContact}
      onDelete={onDeleteContact}
      onToggleFavorite={onToggleFavorite}
      showActions={mode === 'manage'}
    />
  );

  // If no contacts, show empty state
  if (contacts.length === 0) {
    return (
      <View style={styles.container}>
        {renderSearchBar()}
        {renderEmptyState()}
      </View>
    );
  }

  const sectionsData = getSectionsData();

  return (
    <View style={styles.container}>
      {renderSearchBar()}

      <FlatList
        data={sectionsData.length > 0 ? sectionsData.flatMap(s => s.data) : contacts}
        keyExtractor={(item) => item.id}
        renderItem={renderContactItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
        // Performance optimizations
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={10}
        removeClippedSubviews={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  searchBar: {
    backgroundColor: colors.surfaceLight,
    borderRadius: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  searchPlaceholder: {
    color: colors.textMuted,
    fontSize: typography.bodySm,
  },

  listContent: {
    paddingBottom: spacing.xl,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.h4,
    fontWeight: typography.semiBold,
  },

  sectionCount: {
    color: colors.textMuted,
    fontSize: typography.caption,
    marginLeft: spacing.sm,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
    opacity: 0.5,
  },

  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.h2,
    fontWeight: typography.bold,
    marginBottom: spacing.sm,
  },

  emptyMessage: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  emptyAction: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: spacing.sm,
  },

  emptyActionText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: typography.semiBold,
  },
});
