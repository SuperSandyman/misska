import type { TimelineNote } from '../timeline/utils.js';

export type UIMode = 'timeline' | 'command' | 'post' | 'reaction';

export interface CommandContext {
    currentAccountId: string;
    uiMode: UIMode;
    setUiMode: (m: UIMode) => void;
    setInput: (s: string) => void;
    setError: (s: string | null) => void;
    setInfo: (s: string | null) => void;
    setScreen: (s: 'timeline' | 'info') => void;
    setStatus: (s: string) => void;
    notes: TimelineNote[];
    offset: number;
    setNotes: (v: TimelineNote[]) => void;
    sortNotesByDate: (arr: TimelineNote[]) => TimelineNote[];
    setOffset: (v: number) => void;
    apiRequest: <T = unknown>(endpoint: string, body?: unknown) => Promise<T>;
    fetchLatestNote: () => Promise<unknown | null>;
    fetchFresh: (limit: number) => Promise<TimelineNote[]>;
    switchAccount: (query: string) => Promise<void>;
    exit: () => void;
}
