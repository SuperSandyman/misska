import Conf from 'conf';

export interface AccountInfo {
    id: string; // internal id (e.g., baseUrl + ':' + username or uuid)
    baseUrl: string;
    username?: string;
    host?: string | null;
}

export interface AppConfigSchema {
    currentAccountId?: string | null;
    accounts?: AccountInfo[];
    themeColors?: Record<string, string>; // key: host (e.g., "misskey.io"), value: hex color
}

const CONFIG_NAME = 'misska';

const conf = new Conf<AppConfigSchema>({
    projectName: CONFIG_NAME
});

export const getConfig = (): AppConfigSchema => ({
    currentAccountId: conf.get('currentAccountId') ?? null,
    accounts: conf.get('accounts') ?? [],
    themeColors: conf.get('themeColors') ?? {}
});

export const setCurrentAccount = (account: AccountInfo): void => {
    const cfg = getConfig();
    const accounts = cfg.accounts ?? [];
    const idx = accounts.findIndex((a) => a.id === account.id);
    if (idx >= 0) accounts[idx] = account;
    else accounts.push(account);
    conf.set('accounts', accounts);
    conf.set('currentAccountId', account.id);
};

export const findAccountById = (id: string | null | undefined): AccountInfo | undefined => {
    if (!id) return undefined;
    const cfg = getConfig();
    return (cfg.accounts ?? []).find((a) => a.id === id);
};

export const getThemeColor = (host: string): string | undefined => {
    const cfg = getConfig();
    return (cfg.themeColors ?? {})[host];
};

export const setThemeColor = (host: string, color: string): void => {
    const current = conf.get('themeColors') ?? {};
    current[host] = color;
    conf.set('themeColors', current);
};
