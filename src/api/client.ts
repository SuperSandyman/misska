import { fetch, type Response } from 'undici';
import { URL } from 'node:url';

export const normalizeBaseUrl = (input: string): string => {
    let s = (input || '').trim();
    if (!/^https?:\/\//i.test(s)) {
        s = `https://${s}`; // デフォルトは https
    }
    try {
        const u = new URL(s);
        // origin 部分のみ採用し、末尾スラッシュを除去
        return u.origin.replace(/\/+$/, '');
    } catch {
        // URL として解釈できない場合でも末尾スラッシュだけは除去
        return s.replace(/\/+$/, '');
    }
};

export interface MisskeyClientOptions {
    baseUrl: string; // e.g. https://misskey.io
    token?: string; // user access token (optional for public endpoints)
    userAgent?: string;
}

export interface ApiErrorBody {
    error?: {
        code?: string;
        message?: string;
    };
}

export class MisskeyClient {
    private readonly baseUrl: string;
    private readonly token: string | undefined;
    private readonly userAgent: string | undefined;

    constructor(opts: MisskeyClientOptions) {
        this.baseUrl = normalizeBaseUrl(opts.baseUrl);
        this.token = opts.token;
        this.userAgent = opts.userAgent ?? 'misskey-cli-client';
    }

    // Generic POST to /api/<endpoint>
    async post<T>(endpoint: string, body?: unknown): Promise<T> {
        const url = `${this.baseUrl}/api/${endpoint}`;
        const payload = this.token ? { ...((body as object) ?? {}), i: this.token } : (body ?? {});

        let res: Response;
        try {
            res = (await fetch(url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json; charset=utf-8',
                    accept: 'application/json',
                    'user-agent': this.userAgent ?? 'misskey-cli-client'
                },
                body: JSON.stringify(payload)
            })) as Response;
        } catch (e) {
            const errAny = e as unknown as { message?: string; code?: string; syscall?: string; cause?: unknown };
            const causeAny = (errAny?.cause ?? {}) as { code?: string; syscall?: string };
            const msg = errAny?.message ?? String(e);
            const code = errAny?.code || causeAny?.code || 'unknown';
            const syscall = errAny?.syscall || causeAny?.syscall || '?';
            const hint = this.baseUrl.match(/^https?:\/\//i)
                ? ''
                : '（インスタンスURLに http(s) スキームが含まれているか確認してください）';
            const err = new Error(
                `Network fetch failed: ${msg} (code=${code}, syscall=${syscall}) at ${url} ${hint}`.trim()
            );
            throw err;
        }

        const contentType = res.headers.get('content-type') ?? '';
        const isJson = contentType.includes('application/json');
        const data = isJson ? await res.json() : await res.text();

        if (!res.ok) {
            const errBody = isJson ? (data as ApiErrorBody) : undefined;
            const code = errBody?.error?.code ?? `HTTP_${res.status}`;
            const message = errBody?.error?.message ?? (typeof data === 'string' ? data : 'Request failed');
            const error = new Error(`Misskey API error: ${code}: ${message}`);
            // @ts-expect-error attach fields for diagnostics
            error.statusCode = res.status;
            throw error;
        }

        return data as T;
    }

    /**
     * Debug helper: fetch the latest note (notes/timeline limit=1)
     * Returns the first note or null if none.
     */
    async fetchLatestNote(): Promise<unknown | null> {
        try {
            const res = await this.post<unknown[]>('notes/timeline', { limit: 1 });
            return Array.isArray(res) && res.length > 0 ? res[0] : null;
        } catch {
            return null;
        }
    }
}
