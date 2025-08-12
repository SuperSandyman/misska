import { MisskeyClient } from './client.js';

export interface Note {
    id: string;
    createdAt?: string;
    text?: string | null;
    userId?: string;
}

export interface CreateNoteParams {
    text: string;
    visibility?: 'public' | 'home' | 'followers' | 'specified';
}

export const createNote = async (client: MisskeyClient, params: CreateNoteParams): Promise<Note> => {
    return client.post<Note>('notes/create', params);
};

export interface TimelineParams {
    limit?: number;
    sinceId?: string;
    untilId?: string;
}

export const getHomeTimeline = async (client: MisskeyClient, params: TimelineParams = {}): Promise<Note[]> => {
    return client.post<Note[]>('notes/timeline', { limit: 20, ...params });
};

export const getLocalTimeline = async (client: MisskeyClient, params: TimelineParams = {}): Promise<Note[]> => {
    return client.post<Note[]>('notes/local-timeline', { limit: 20, ...params });
};
