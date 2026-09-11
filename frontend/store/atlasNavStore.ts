import { create } from 'zustand';

interface AtlasNavState {
  selectedConversationId: string | null;
  selectConversation: (id: string | null) => void;
  triggerNewChat: number;
  newChat: () => void;
}

export const useAtlasNavStore = create<AtlasNavState>((set) => ({
  selectedConversationId: null,
  selectConversation: (id) => set({ selectedConversationId: id }),
  triggerNewChat: 0,
  newChat: () => set((s) => ({ selectedConversationId: null, triggerNewChat: s.triggerNewChat + 1 })),
}));
