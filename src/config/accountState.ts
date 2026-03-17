import { normalizeBaseUrl } from '../api/client.js';

export interface AccountInfo {
    id: string;
    baseUrl: string;
    userId?: string;
    username?: string;
    host?: string | null;
    label?: string;
    legacyIds?: string[];
}

export interface AppConfigState {
    currentAccountId: string | null;
    accounts: AccountInfo[];
    themeColors: Record<string, string>;
}

export interface AppConfigSchema extends Partial<AppConfigState> {
    baseUrl?: string;
    accountId?: string;
    username?: string;
    host?: string | null;
}

const uniq = (values: Array<string | null | undefined>): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        if (!value || seen.has(value)) continue;
        seen.add(value);
        result.push(value);
    }
    return result;
};

const withProp = <T extends object, K extends string, V>(obj: T, key: K, value: V | undefined): T & Record<K, V> | T =>
    value === undefined ? obj : { ...obj, [key]: value };

const normalizeHandle = (username?: string, host?: string | null): string | undefined => {
    if (!username) return undefined;
    return host ? `@${username}@${host}` : `@${username}`;
};

export const buildLegacyAccountId = (baseUrl: string, username?: string, host?: string | null): string => {
    const normalized = normalizeBaseUrl(baseUrl);
    const handle = username ? `${username}${host ? `@${host}` : ''}` : normalized;
    return `${normalized}#${handle}`;
};

export const buildAccountId = (
    baseUrl: string,
    userId?: string,
    username?: string,
    host?: string | null
): string => {
    const normalized = normalizeBaseUrl(baseUrl);
    if (userId) return `${normalized}#user:${userId}`;
    return buildLegacyAccountId(normalized, username, host);
};

export const buildAccountLabel = (baseUrl: string, username?: string, host?: string | null): string => {
    const normalized = normalizeBaseUrl(baseUrl);
    const urlHost = (() => {
        try {
            return new URL(normalized).host;
        } catch {
            return normalized;
        }
    })();
    return normalizeHandle(username, host) ?? urlHost;
};

export const normalizeAccount = (account: Partial<AccountInfo> & Pick<AccountInfo, 'baseUrl'>): AccountInfo => {
    const normalizedBaseUrl = normalizeBaseUrl(account.baseUrl);
    const id = account.id ?? buildAccountId(normalizedBaseUrl, account.userId, account.username, account.host ?? null);
    const legacyId = buildLegacyAccountId(normalizedBaseUrl, account.username, account.host ?? null);

    let normalized: AccountInfo = {
        id,
        baseUrl: normalizedBaseUrl,
        host: account.host ?? null,
        label: account.label ?? buildAccountLabel(normalizedBaseUrl, account.username, account.host ?? null),
        legacyIds: uniq([...(account.legacyIds ?? []), id === legacyId ? null : legacyId])
    };
    normalized = withProp(normalized, 'userId', account.userId) as AccountInfo;
    normalized = withProp(normalized, 'username', account.username) as AccountInfo;
    return normalized;
};

export const migrateConfigState = (input: AppConfigSchema): AppConfigState => {
    const migratedAccounts = (input.accounts ?? []).map((account) => normalizeAccount(account));

    if (migratedAccounts.length === 0 && input.baseUrl) {
        migratedAccounts.push(
            normalizeAccount({
                ...(input.accountId ? { id: input.accountId } : {}),
                ...(input.username ? { username: input.username } : {}),
                baseUrl: input.baseUrl,
                host: input.host ?? null
            })
        );
    }

    const currentAccountId =
        input.currentAccountId && migratedAccounts.some((account) => account.id === input.currentAccountId)
            ? input.currentAccountId
            : migratedAccounts[0]?.id ?? null;

    return {
        currentAccountId,
        accounts: migratedAccounts,
        themeColors: input.themeColors ?? {}
    };
};

export const resolveAccountInState = (state: AppConfigState, query: string): AccountInfo | undefined => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return undefined;

    const lower = normalizedQuery.toLowerCase();
    return state.accounts.find((account) => {
        const candidates = uniq([
            account.id,
            account.label,
            normalizeHandle(account.username, account.host ?? null),
            account.username,
            account.baseUrl,
            account.baseUrl.replace(/^https?:\/\//, '')
        ]);
        return candidates.some((candidate) => candidate.toLowerCase() === lower);
    });
};
