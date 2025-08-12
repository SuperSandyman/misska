import { MisskeyClient } from './client.js';

export interface MeDetailed {
    id: string;
    username: string;
    host?: string | null;
    name?: string | null;
}

export const getMe = async (client: MisskeyClient): Promise<MeDetailed> => {
    // /api/i は POST で body: { i: <token> } だけで OK
    const me = await client.post<MeDetailed>('i');
    return me;
};
