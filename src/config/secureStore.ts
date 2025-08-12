import keytar from 'keytar';

const SERVICE = 'misska';

export const saveToken = async (accountId: string, token: string): Promise<void> => {
    await keytar.setPassword(SERVICE, accountId, token);
};

export const loadToken = async (accountId: string): Promise<string | null> => {
    try {
        return await keytar.getPassword(SERVICE, accountId);
    } catch {
        return null;
    }
};

export const deleteToken = async (accountId: string): Promise<void> => {
    try {
        await keytar.deletePassword(SERVICE, accountId);
    } catch {
        // ignore
    }
};
