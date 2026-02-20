import * as SecureStore from 'expo-secure-store';
import { Contact, ContactFormData } from '../types';

// Storage keys
const STORAGE_KEYS = {
  CONTACTS: 'warthog_contacts_v1',
  METADATA: 'warthog_contacts_meta_v1',
  BACKUP: 'warthog_contacts_backup_v1',
} as const;

// Storage data format
interface ContactStorageData {
  version: '1.0.0';
  contacts: Contact[];
  createdAt: Date;
  updatedAt: Date;
  checksum: string;
}

// Encryption options for SecureStore
const ENCRYPTION_OPTIONS = {
  keychainService: 'warthog-wallet-contacts',
  sharedPreferencesName: 'warthog-contacts',
  encrypt: true,
  requireAuthentication: false,
  accessGroup: undefined,
};

/**
 * Secure storage utility for address book contacts
 * All contact data is encrypted before storage
 */
export class ContactStorage {
  private static readonly STORAGE_KEY = STORAGE_KEYS.CONTACTS;

  /**
   * Get all contacts from secure storage
   */
  static async getContacts(): Promise<Contact[]> {
    try {
      const encryptedData = await SecureStore.getItemAsync(this.STORAGE_KEY, ENCRYPTION_OPTIONS);

      if (!encryptedData) {
        return [];
      }

      const storageData: ContactStorageData = JSON.parse(encryptedData);

      // Validate data integrity
      if (!this.validateStorageData(storageData)) {
        console.warn('Contact storage data integrity check failed, returning empty array');
        return [];
      }

      // Convert date strings back to Date objects
      return storageData.contacts.map(contact => ({
        ...contact,
        createdAt: new Date(contact.createdAt),
        lastUsed: contact.lastUsed ? new Date(contact.lastUsed) : undefined,
      }));
    } catch (error) {
      console.error('Error loading contacts:', error);
      return [];
    }
  }

  /**
   * Save a new contact to storage
   */
  static async saveContact(contactData: ContactFormData): Promise<Contact> {
    try {
      // Check for duplicate addresses
      const existingContacts = await this.getContacts();
      const duplicate = existingContacts.find(c => c.address.toLowerCase() === contactData.address.toLowerCase());

      if (duplicate) {
        throw new Error('A contact with this address already exists');
      }

      // Create new contact
      const newContact: Contact = {
        id: this.generateId(),
        name: contactData.name.trim(),
        address: contactData.address.toLowerCase(), // Normalize to lowercase
        notes: contactData.notes?.trim(),
        createdAt: new Date(),
        isFavorite: contactData.isFavorite || false,
        usageCount: 0,
        tags: [],
      };

      // Save to storage
      const updatedContacts = [...existingContacts, newContact];
      await this.saveContactsToStorage(updatedContacts);

      return newContact;
    } catch (error) {
      console.error('Error saving contact:', error);
      throw error;
    }
  }

  /**
   * Update an existing contact
   */
  static async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    try {
      const contacts = await this.getContacts();
      const contactIndex = contacts.findIndex(c => c.id === id);

      if (contactIndex === -1) {
        throw new Error('Contact not found');
      }

      // Check for duplicate address if address is being updated
      if (updates.address) {
        const duplicate = contacts.find(c =>
          c.id !== id && c.address.toLowerCase() === updates.address!.toLowerCase()
        );
        if (duplicate) {
          throw new Error('A contact with this address already exists');
        }
        updates.address = updates.address.toLowerCase();
      }

      const updatedContact = {
        ...contacts[contactIndex],
        ...updates,
        name: updates.name?.trim() || contacts[contactIndex].name,
        notes: updates.notes?.trim(),
      };

      contacts[contactIndex] = updatedContact;
      await this.saveContactsToStorage(contacts);

      return updatedContact;
    } catch (error) {
      console.error('Error updating contact:', error);
      throw error;
    }
  }

  /**
   * Delete a contact by ID
   */
  static async deleteContact(id: string): Promise<boolean> {
    try {
      const contacts = await this.getContacts();
      const filteredContacts = contacts.filter(c => c.id !== id);

      if (filteredContacts.length === contacts.length) {
        return false; // Contact not found
      }

      await this.saveContactsToStorage(filteredContacts);
      return true;
    } catch (error) {
      console.error('Error deleting contact:', error);
      return false;
    }
  }

  /**
   * Find a contact by address
   */
  static async findByAddress(address: string): Promise<Contact | null> {
    try {
      const contacts = await this.getContacts();
      return contacts.find(c => c.address.toLowerCase() === address.toLowerCase()) || null;
    } catch (error) {
      console.error('Error finding contact by address:', error);
      return null;
    }
  }

  /**
   * Increment usage count for a contact
   */
  static async incrementUsage(id: string): Promise<void> {
    try {
      await this.updateContact(id, {
        usageCount: (await this.getContact(id))?.usageCount || 0 + 1,
        lastUsed: new Date(),
      });
    } catch (error) {
      console.error('Error incrementing usage:', error);
    }
  }

  /**
   * Get a single contact by ID
   */
  static async getContact(id: string): Promise<Contact | null> {
    try {
      const contacts = await this.getContacts();
      return contacts.find(c => c.id === id) || null;
    } catch (error) {
      console.error('Error getting contact:', error);
      return null;
    }
  }

  /**
   * Get recent contacts (last used)
   */
  static async getRecentContacts(limit: number = 5): Promise<Contact[]> {
    try {
      const contacts = await this.getContacts();
      return contacts
        .filter(c => c.lastUsed)
        .sort((a, b) => (b.lastUsed!.getTime() - a.lastUsed!.getTime()))
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting recent contacts:', error);
      return [];
    }
  }

  /**
   * Get favorite contacts
   */
  static async getFavoriteContacts(): Promise<Contact[]> {
    try {
      const contacts = await this.getContacts();
      return contacts.filter(c => c.isFavorite);
    } catch (error) {
      console.error('Error getting favorite contacts:', error);
      return [];
    }
  }

  /**
   * Export contacts as JSON string
   */
  static async exportContacts(): Promise<string> {
    try {
      const contacts = await this.getContacts();
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        contacts: contacts.map(c => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          lastUsed: c.lastUsed?.toISOString(),
        })),
      };
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Error exporting contacts:', error);
      throw error;
    }
  }

  /**
   * Import contacts from JSON string
   */
  static async importContacts(data: string): Promise<Contact[]> {
    try {
      const importData = JSON.parse(data);

      if (!importData.contacts || !Array.isArray(importData.contacts)) {
        throw new Error('Invalid import data format');
      }

      // Convert imported contacts to proper format
      const importedContacts: Contact[] = importData.contacts.map((c: any) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        lastUsed: c.lastUsed ? new Date(c.lastUsed) : undefined,
      }));

      // Merge with existing contacts, avoiding duplicates
      const existingContacts = await this.getContacts();
      const mergedContacts = [...existingContacts];

      for (const imported of importedContacts) {
        const existing = mergedContacts.find(c => c.address.toLowerCase() === imported.address.toLowerCase());
        if (!existing) {
          mergedContacts.push({
            ...imported,
            id: this.generateId(), // Generate new ID for imported contacts
          });
        }
      }

      await this.saveContactsToStorage(mergedContacts);
      return mergedContacts;
    } catch (error) {
      console.error('Error importing contacts:', error);
      throw error;
    }
  }

  /**
   * Clear all contacts (dangerous operation)
   */
  static async clearAllContacts(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(this.STORAGE_KEY, ENCRYPTION_OPTIONS);
    } catch (error) {
      console.error('Error clearing contacts:', error);
      throw error;
    }
  }

  // Private helper methods

  private static async saveContactsToStorage(contacts: Contact[]): Promise<void> {
    const storageData: ContactStorageData = {
      version: '1.0.0',
      contacts,
      createdAt: new Date(),
      updatedAt: new Date(),
      checksum: this.generateChecksum(contacts),
    };

    const encryptedData = JSON.stringify(storageData);
    await SecureStore.setItemAsync(this.STORAGE_KEY, encryptedData, ENCRYPTION_OPTIONS);
  }

  private static validateStorageData(data: any): boolean {
    return (
      data &&
      data.version === '1.0.0' &&
      Array.isArray(data.contacts) &&
      data.createdAt &&
      data.updatedAt &&
      data.checksum
    );
  }

  private static generateChecksum(contacts: Contact[]): string {
    // Simple checksum based on contact count and last update
    const contactIds = contacts.map(c => c.id).sort().join('');
    return btoa(contactIds).substring(0, 16);
  }

  private static generateId(): string {
    return `contact_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}
