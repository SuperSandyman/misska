import { MisskeyClient, normalizeBaseUrl } from './client.js';
import { URLSearchParams } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export interface MiAuthUrlOptions {
    sessionId: string;
    name: string;
    iconUrl?: string;
    callback?: string;
    permission?: string[];
}

export interface MiAuthGenTokenResponse {
    token: string;
    user: {
        id: string;
        username: string;
        host?: string | null;
    };
}

export interface MiAuthCheckResponse {
    ok: boolean;
    token?: string;
    user?: {
        id: string;
        username: string;
        host?: string | null;
    };
}

const buildQuery = (params: Record<string, string | undefined>): URLSearchParams => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) search.set(k, v);
    }
    return search;
};

export const buildMiAuthUrl = (baseUrl: string, opts: MiAuthUrlOptions): string => {
    const origin = normalizeBaseUrl(baseUrl);
    const permCsv = opts.permission && opts.permission.length > 0 ? opts.permission.join(',') : undefined;
    const q = buildQuery({
        name: opts.name,
        icon: opts.iconUrl,
        callback: opts.callback,
        permission: permCsv
    });
    const qstr = q.toString();
    return `${origin}/miauth/${encodeURIComponent(opts.sessionId)}${qstr ? `?${qstr}` : ''}`;
};

export const tryExchangeMiAuthToken = async (
    client: MisskeyClient,
    sessionId: string
): Promise<MiAuthGenTokenResponse> => {
    // POST /api/miauth/gen-token { sessionId }
    // 成功時 { token, user }
    // 未承認/期限切れなどではエラーや空レスポンスの場合がある
    // インスタンスによりパラメータ名が `session` の場合があるため両方送る
    const res = await client.post<MiAuthGenTokenResponse>('miauth/gen-token', { sessionId, session: sessionId });
    if (!res || !res.token) {
        throw new Error('MiAuth not authorized yet');
    }
    return res;
};

const sleep = (ms: number): Promise<void> => delay(ms) as Promise<void>;

export interface PollOptions {
    intervalMs?: number;
    timeoutMs?: number;
}

export const pollMiAuthToken = async (
    client: MisskeyClient,
    sessionId: string,
    options: PollOptions = {}
): Promise<MiAuthGenTokenResponse> => {
    const intervalMs = options.intervalMs ?? 1000;
    const timeoutMs = options.timeoutMs ?? 2 * 60 * 1000;
    const start = Date.now();
    while (true) {
        if (Date.now() - start > timeoutMs) {
            throw new Error('MiAuth polling timed out');
        }
        // 1) 推奨の /api/miauth/{session}/check を優先
        try {
            const checked = await tryCheckMiAuthToken(client, sessionId);
            return checked;
        } catch {
            // ignore and fallback to gen-token
        }
        // 2) 旧来/互換の gen-token を試す
        try {
            const exchanged = await tryExchangeMiAuthToken(client, sessionId);
            return exchanged;
        } catch {
            // not ready yet
        }
        await sleep(intervalMs);
    }
};

export const tryCheckMiAuthToken = async (
    client: MisskeyClient,
    sessionId: string
): Promise<MiAuthGenTokenResponse> => {
    // POST /api/miauth/{session}/check
    // レスポンス例: { ok: true, token, user } / { ok: false }
    const res = await client.post<MiAuthCheckResponse>(`miauth/${encodeURIComponent(sessionId)}/check`, {});
    if (res && res.ok && res.token && res.user) {
        return { token: res.token, user: res.user };
    }
    throw new Error('MiAuth not authorized yet');
};
