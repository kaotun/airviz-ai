import { create } from 'zustand';

type ChatStatus = 'idle' | 'loading' | 'answered' | 'pending_approval' | 'executing' | 'executed';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    type?: 'text' | 'sql' | 'chart' | 'data';
    metadata?: any;
}

interface ChatState {
    status: ChatStatus;
    messages: ChatMessage[];
    
    // Actions
    setStatus: (status: ChatStatus) => void;
    addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
    clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
    status: 'idle',
    messages: [],

    setStatus: (status) => set({ status }),
    
    addMessage: (message) => set((state) => ({
        messages: [
            ...state.messages,
            {
                ...message,
                id: Math.random().toString(36).substring(7),
                timestamp: new Date()
            }
        ]
    })),

    clearMessages: () => set({ messages: [], status: 'idle' })
}));
