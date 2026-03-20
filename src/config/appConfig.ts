import Conf from 'conf';
import {
    migrateConfigState,
    normalizeAccount,
    resolveAccountInState,
    type AccountInfo,
    type AppConfigSchema,
    type AppConfigState
} from './accountState.js';
export type { AccountInfo, AppConfigSchema, AppConfigState } from './accountState.js';

const CONFIG_NAME = 'misska';

const conf = new Conf<AppConfigSchema>({
    projectName: CONFIG_NAME
});

const persistConfig = (state: AppConfigState): void => {
    conf.set('currentAccountId', state.currentAccountId);
    conf.set('accounts', state.accounts);
    conf.set('themeColors', state.themeColors);
    conf.delete('baseUrl');
    conf.delete('accountId');
    conf.delete('username');
    conf.delete('host');
};

const readConfigSchema = (): AppConfigSchema => ({
    ...(conf.get('currentAccountId') !== undefined ? { currentAccountId: conf.get('currentAccountId') } : {}),
    ...(conf.get('accounts') !== undefined ? { accounts: conf.get('accounts') } : {}),
    ...(conf.get('themeColors') !== undefined ? { themeColors: conf.get('themeColors') } : {}),
    ...(conf.get('baseUrl') !== undefined ? { baseUrl: conf.get('baseUrl') } : {}),
    ...(conf.get('accountId') !== undefined ? { accountId: conf.get('accountId') } : {}),
    ...(conf.get('username') !== undefined ? { username: conf.get('username') } : {}),
    ...(conf.get('host') !== undefined ? { host: conf.get('host') } : {})
});

const hasLegacyConfig = (state: AppConfigSchema): boolean =>
    state.baseUrl !== undefined ||
    state.accountId !== undefined ||
    state.username !== undefined ||
    state.host !== undefined;

const isPersistRequired = (input: AppConfigSchema, migrated: AppConfigState): boolean => {
    if (hasLegacyConfig(input)) return true;

    const currentAccountId = input.currentAccountId ?? null;
    const accounts = input.accounts ?? [];
    const themeColors = input.themeColors ?? {};

    return (
        currentAccountId !== migrated.currentAccountId ||
        JSON.stringify(accounts) !== JSON.stringify(migrated.accounts) ||
        JSON.stringify(themeColors) !== JSON.stringify(migrated.themeColors)
    );
};

export const getConfig = (): AppConfigState => {
    const rawState = readConfigSchema();
    const migratedState = migrateConfigState(rawState);
    if (isPersistRequired(rawState, migratedState)) {
        persistConfig(migratedState);
    }
    return migratedState;
};

export const listAccounts = (): AccountInfo[] => getConfig().accounts;

export const findAccountById = (id: string | null | undefined): AccountInfo | undefined => {
    if (!id) return undefined;
    return listAccounts().find((account) => account.id === id);
};

export const getCurrentAccount = (): AccountInfo | undefined => {
    const cfg = getConfig();
    return cfg.accounts.find((account) => account.id === cfg.currentAccountId);
};

export const saveAccount = (account: Partial<AccountInfo> & Pick<AccountInfo, 'baseUrl'>): AccountInfo => {
    const normalized = normalizeAccount(account);
    const cfg = getConfig();
    const accounts = cfg.accounts.filter((item) => item.id !== normalized.id);
    accounts.push(normalized);
    persistConfig({
        ...cfg,
        currentAccountId: normalized.id,
        accounts
    });
    return normalized;
};

export const setCurrentAccountId = (accountId: string): AccountInfo => {
    const cfg = getConfig();
    const account = cfg.accounts.find((item) => item.id === accountId);
    if (!account) {
        throw new Error(`アカウントが見つかりません: ${accountId}`);
    }
    persistConfig({
        ...cfg,
        currentAccountId: account.id
    });
    return account;
};

export const resolveAccount = (query: string): AccountInfo | undefined => {
    return resolveAccountInState(getConfig(), query);
};

export const getThemeColor = (host: string): string | undefined => getConfig().themeColors[host];

export const setThemeColor = (host: string, color: string): void => {
    const cfg = getConfig();
    persistConfig({
        ...cfg,
        themeColors: {
            ...cfg.themeColors,
            [host]: color
        }
    });
};
