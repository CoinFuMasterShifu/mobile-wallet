import { useState, useEffect, useCallback, useMemo } from 'react';
import { Contact, ContactFormData, AddressBookState } from '../types';
import { ContactStorage } from '../utils/contactStorage';

type SortOption = 'name' | 'recent' | 'frequency' | 'favorites';

/**
 * Custom hook for managing address book functionality
 * Provides CRUD operations, search, filtering, and state management
 */
export const useAddressBook = () => {
  const [state, setState] = useState<AddressBookState>({
    contacts: [],
    isLoading: false,
    error: null,
    searchQuery: '',
    sortBy: 'name',
    filterTags: [],
  });

  // Load contacts on mount
  useEffect(() => {
    loadContacts();
  }, []);

  /**
   * Load all contacts from storage
   */
  const loadContacts = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const contacts = await ContactStorage.getContacts();
      setState(prev => ({
        ...prev,
        contacts,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error loading contacts:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load contacts',
      }));
    }
  }, []);

  /**
   * Add a new contact
   */
  const addContact = useCallback(async (contactData: ContactFormData): Promise<Contact> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const newContact = await ContactStorage.saveContact(contactData);
      setState(prev => ({
        ...prev,
        contacts: [...prev.contacts, newContact],
        isLoading: false,
      }));
      return newContact;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add contact';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  /**
   * Update an existing contact
   */
  const updateContact = useCallback(async (id: string, updates: Partial<Contact>): Promise<Contact> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const updatedContact = await ContactStorage.updateContact(id, updates);
      setState(prev => ({
        ...prev,
        contacts: prev.contacts.map(c => c.id === id ? updatedContact : c),
        isLoading: false,
      }));
      return updatedContact;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update contact';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  /**
   * Delete a contact
   */
  const deleteContact = useCallback(async (id: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const success = await ContactStorage.deleteContact(id);
      if (success) {
        setState(prev => ({
          ...prev,
          contacts: prev.contacts.filter(c => c.id !== id),
          isLoading: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Contact not found',
        }));
      }
      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete contact';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return false;
    }
  }, []);

  /**
   * Set search query
   */
  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  /**
   * Set sort option
   */
  const setSortBy = useCallback((sortBy: SortOption) => {
    setState(prev => ({ ...prev, sortBy }));
  }, []);

  /**
   * Clear search query
   */
  const clearSearch = useCallback(() => {
    setState(prev => ({ ...prev, searchQuery: '' }));
  }, []);

  /**
   * Refresh contacts from storage
   */
  const refreshContacts = useCallback(async () => {
    await loadContacts();
  }, [loadContacts]);

  /**
   * Get contact by address
   */
  const getContactByAddress = useCallback((address: string): Contact | undefined => {
    const normalizedAddress = address.toLowerCase().replace(/^0x/, '');
    const contact = state.contacts.find(c => c.address.toLowerCase().replace(/^0x/, '') === normalizedAddress);
    console.log('getContactByAddress:', address, 'normalized:', normalizedAddress, 'contacts count:', state.contacts.length, 'found:', !!contact, contact?.name);
    return contact;
  }, [state.contacts]);

  /**
   * Increment usage count for a contact
   */
  const incrementUsage = useCallback(async (id: string): Promise<void> => {
    try {
      await ContactStorage.incrementUsage(id);
      // Update local state
      setState(prev => ({
        ...prev,
        contacts: prev.contacts.map(c =>
          c.id === id
            ? { ...c, usageCount: c.usageCount + 1, lastUsed: new Date() }
            : c
        ),
      }));
    } catch (error) {
      console.error('Error incrementing usage:', error);
    }
  }, []);

  /**
   * Get recent contacts
   */
  const getRecentContacts = useCallback(async (limit: number = 5): Promise<Contact[]> => {
    return await ContactStorage.getRecentContacts(limit);
  }, []);

  /**
   * Get favorite contacts
   */
  const getFavoriteContacts = useCallback(async (): Promise<Contact[]> => {
    return await ContactStorage.getFavoriteContacts();
  }, []);

  /**
   * Toggle favorite status of a contact
   */
  const toggleFavorite = useCallback(async (id: string): Promise<void> => {
    try {
      const contact = state.contacts.find(c => c.id === id);
      if (!contact) throw new Error('Contact not found');
      await updateContact(id, { isFavorite: !contact.isFavorite });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  }, [state.contacts, updateContact]);

  /**
   * Filtered and sorted contacts based on current state
   */
  const filteredContacts = useMemo(() => {
    let filtered = [...state.contacts];

    // Apply search filter
    if (state.searchQuery.trim()) {
      const query = state.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(query) ||
        contact.address.toLowerCase().includes(query) ||
        (contact.notes && contact.notes.toLowerCase().includes(query))
      );
    }

    // Apply tag filter (future feature)
    if (state.filterTags.length > 0) {
      filtered = filtered.filter(contact =>
        contact.tags?.some(tag => state.filterTags.includes(tag))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (state.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);

        case 'recent':
          const aTime = a.lastUsed?.getTime() || 0;
          const bTime = b.lastUsed?.getTime() || 0;
          return bTime - aTime; // Most recent first

        case 'frequency':
          return b.usageCount - a.usageCount; // Most used first

        case 'favorites':
          // Favorites first, then alphabetical
          if (a.isFavorite && !b.isFavorite) return -1;
          if (!a.isFavorite && b.isFavorite) return 1;
          return a.name.localeCompare(b.name);

        default:
          return 0;
      }
    });

    return filtered;
  }, [state.contacts, state.searchQuery, state.sortBy, state.filterTags]);

  /**
   * Export contacts as JSON string
   */
  const exportContacts = useCallback(async (): Promise<string> => {
    return await ContactStorage.exportContacts();
  }, []);

  /**
   * Import contacts from JSON string
   */
  const importContacts = useCallback(async (data: string): Promise<Contact[]> => {
    const importedContacts = await ContactStorage.importContacts(data);
    // Refresh local state
    await loadContacts();
    return importedContacts;
  }, [loadContacts]);

  return {
    // State
    contacts: state.contacts,
    filteredContacts,
    isLoading: state.isLoading,
    error: state.error,
    searchQuery: state.searchQuery,
    sortBy: state.sortBy,

    // Actions
    loadContacts,
    addContact,
    updateContact,
    deleteContact,
    toggleFavorite,
    setSearchQuery,
    setSortBy,
    clearSearch,
    refreshContacts,
    getContactByAddress,
    incrementUsage,
    getRecentContacts,
    getFavoriteContacts,
    exportContacts,
    importContacts,
  };
};
