import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type EmergencyContact = { id: string; name: string; phone: string };

type ContactsState = {
  contacts: EmergencyContact[];
  add: (name: string, phone: string) => void;
  remove: (id: string) => void;
};

/** Acil durum kişileri sadece bu telefonda saklanır (sunucuya gönderilmez). */
export const useContactsStore = create<ContactsState>()(
  persist(
    (set) => ({
      contacts: [],
      add: (name, phone) => set((s) => ({ contacts: [...s.contacts, { id: `${Date.now()}`, name: name.trim(), phone: phone.trim() }] })),
      remove: (id) => set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),
    }),
    { name: 'yola-emergency-contacts', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
