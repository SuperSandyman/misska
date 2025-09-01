import { MisskeyClient } from './client.js';

export interface Emoji {
    name: string;
    host?: string | null;
    url?: string;
    aliases?: string[];
    category?: string | null;
}

export const getEmojis = async (client: MisskeyClient): Promise<Emoji[]> => {
    // Misskey: POST /api/emojis returns the instance custom emoji list
    return client.post<Emoji[]>('emojis', {});
};

