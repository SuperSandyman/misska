import { fetch } from 'undici';

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
        this.baseUrl = opts.baseUrl.replace(/\/?$/, '');
        this.token = opts.token;
        this.userAgent = opts.userAgent ?? 'misskey-cli-client';
    }

    // Generic POST to /api/<endpoint>
    async post<T>(endpoint: string, body?: unknown): Promise<T> {
        const url = `${this.baseUrl}/api/${endpoint}`;
        const payload = this.token ? { ...((body as object) ?? {}), i: this.token } : (body ?? {});

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json; charset=utf-8',
                accept: 'application/json',
                'user-agent': this.userAgent ?? 'misskey-cli-client'
            },
            body: JSON.stringify(payload)
        });

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
}
