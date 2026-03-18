#!/usr/bin/env node
import { render, Text, Box } from 'ink';
import React, { useEffect, useState } from 'react';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import tty from 'node:tty';
import console from 'node:console';

import { MisskeyClient, normalizeBaseUrl } from './api/client.js';
import { buildMiAuthUrl, pollMiAuthToken } from './api/miauth.js';
// import { getMe } from './api/auth.js';
import {
    findAccountById,
    getCurrentAccount,
    listAccounts,
    resolveAccount,
    saveAccount,
    setCurrentAccountId,
    type AccountInfo
} from './config/appConfig.js';
import { buildAccountLabel } from './config/accountState.js';
import { loadToken, saveToken } from './config/secureStore.js';
import HomeTimeline from './components/HomeTimeline.js';

function LoginApp({ baseUrl }: { baseUrl: string }) {
    const [message, setMessage] = useState<string>('');

    useEffect(() => {
        (async () => {
            try {
                const sessionId = randomUUID();
                const url = buildMiAuthUrl(baseUrl, {
                    sessionId,
                    name: 'misska',
                    permission: ['read:account', 'read:notes', 'write:notes', 'write:reactions']
                });
                setMessage(
                    `MiAuth URL を開いて承認してください:\n${url}\n要求権限: read:account, read:notes, write:notes, write:reactions\n承認を待機中... (キャンセル: Ctrl+C)`
                );

                const normalized = normalizeBaseUrl(baseUrl);
                const anonClient = new MisskeyClient({ baseUrl: normalized });
                const { token, user } = await pollMiAuthToken(anonClient, sessionId, { timeoutMs: 2 * 60 * 1000 });
                const acct = user.host ? `@${user.username}@${user.host}` : `@${user.username}`;
                const account = saveAccount({
                    baseUrl: normalized,
                    userId: user.id,
                    username: user.username,
                    host: user.host ?? null,
                    label: buildAccountLabel(normalized, user.username, user.host ?? null)
                });
                await saveToken(account.id, token);
                setMessage(`ログイン成功: ${acct}\n現在のアカウント: ${account.label}`);
            } catch (e) {
                const msg = (e as Error).message || 'unknown error';
                setMessage(`ログイン失敗: ${msg}`);
            }
        })();
    }, [baseUrl]);

    return (
        <Box flexDirection="column">
            <Text>{message || '初期化中...'}</Text>
        </Box>
    );
}

interface RuntimeContext {
    account: AccountInfo;
    token: string;
}

function DefaultApp() {
    const [message, setMessage] = useState<string>('');
    const [ready, setReady] = useState(false);
    const [ctx, setCtx] = useState<RuntimeContext | null>(null);
    const [currentAccountId, setCurrentAccountIdState] = useState<string | null>(() => getCurrentAccount()?.id ?? null);

    useEffect(() => {
        (async () => {
            try {
                setReady(false);
                setCtx(null);
                const acc = findAccountById(currentAccountId);
                if (!acc) {
                    setMessage(
                        '未ログインです。`misska login <instance-url>` を実行してください。\n保存済み一覧: `misska accounts`'
                    );
                    return;
                }
                const token = await loadToken(acc.id);
                const fallbackToken = !token
                    ? await Promise.any(
                          (acc.legacyIds ?? []).map(async (legacyId) => {
                              const legacyToken = await loadToken(legacyId);
                              if (!legacyToken) throw new Error('missing');
                              return legacyToken;
                          })
                      ).catch(() => null)
                    : null;
                const activeToken = token ?? fallbackToken;
                if (!activeToken) {
                    setMessage(
                        'トークンが見つかりません。`misska login <instance-url>` を実行してください。\n保存済み一覧: `misska accounts`'
                    );
                    return;
                }
                // トークン検証（/api/i -> read:accountが必要）
                const client = new MisskeyClient({ baseUrl: normalizeBaseUrl(acc.baseUrl), token: activeToken });
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                const { getMe } = await import('./api/auth.js');
                try {
                    await getMe(client);
                    if (!token && fallbackToken) {
                        await saveToken(acc.id, fallbackToken);
                    }
                    setCtx({ account: acc, token: activeToken });
                    setMessage('');
                    setReady(true);
                } catch (e) {
                    const em = (e as Error).message || '';
                    // ネットワーク層の失敗は警告のみにして続行（後段で UI 側が再試行/表示）
                    if (em.startsWith('Network fetch failed:')) {
                        setCtx({ account: acc, token: activeToken });
                        setMessage(
                            '警告: 起動時のトークン検証に失敗しました（ネットワーク）。後続の画面で再試行します。' +
                                '\n詳細: ' +
                                em
                        );
                        setReady(true);
                    } else if (em.startsWith('Misskey API error: PERMISSION_DENIED')) {
                        setMessage(
                            'エラー: 権限不足です（read:account 等）。' +
                                '\nURL とトークンの権限を確認してください。必要なら再ログイン: misska login <instance-url>'
                        );
                        // 続行せず待機
                        setReady(false);
                    } else {
                        throw e;
                    }
                }
            } catch (e) {
                const msg = (e as Error).message || 'unknown error';
                const hint =
                    'URL が正しいか（例: https://example.com）、ネットワーク到達性、プロキシ設定、証明書エラーをご確認ください。' +
                    '\n必要なら再ログイン: misska login <instance-url>';
                setMessage(`エラー: ${msg}\n${hint}`);
            }
        })();
    }, [currentAccountId]);

    const switchAccount = async (query: string) => {
        const target = resolveAccount(query);
        if (!target) {
            throw new Error(`アカウントが見つかりません: ${query}\n一覧: misska accounts`);
        }
        setCurrentAccountId(target.id);
        setCurrentAccountIdState(target.id);
        setMessage(`切替中: ${target.label}`);
    };

    if (message && !ready) return <Text>{message}</Text>;
    if (!ctx) return <Text>初期化中…</Text>;
    return (
        <HomeTimeline
            key={ctx.account.id}
            accountLabel={ctx.account.label ?? ctx.account.id}
            baseUrl={ctx.account.baseUrl}
            token={ctx.token}
            currentAccountId={ctx.account.id}
            onSwitchAccount={switchAccount}
        />
    );
}

const formatAccountLine = (account: AccountInfo, currentId: string | null, index: number): string =>
    `${account.id === currentId ? '(x)' : '( )'} ${index}. ${account.label ?? account.id} -> ${account.baseUrl}`;

const printAccounts = (): void => {
    const current = getCurrentAccount();
    const accounts = listAccounts();
    if (accounts.length === 0) {
        console.log('保存済みアカウントはありません。`misska login <instance-url>` を実行してください。');
        return;
    }
    console.log(
        ['保存済みアカウント:', ...accounts.map((account, index) => formatAccountLine(account, current?.id ?? null, index + 1))].join(
            '\n'
        )
    );
};

const runUseCommand = (query: string | undefined): void => {
    if (!query) {
        console.error('Usage: misska use <number|account>');
        process.exitCode = 1;
        return;
    }
    const target = resolveAccount(query);
    if (!target) {
        console.error(`アカウントが見つかりません: ${query}`);
        printAccounts();
        process.exitCode = 1;
        return;
    }
    setCurrentAccountId(target.id);
    console.log(`現在のアカウントを切り替えました: ${target.label ?? target.id}`);
};

function main() {
    const setupExitBanner = () => {
        let shown = false;
        const show = (msg = '終了処理中…') => {
            if (shown) return;
            shown = true;
            const out = process.stdout as tty.WriteStream;
            // If stdout is a TTY try to restore the alternate screen and clear; otherwise fall back to stderr
            if (out && out.isTTY) {
                try {
                    // combine escape sequences into a single write to reduce partial writes
                    out.write('\x1b[?1049l\x1b[2J\x1b[H');
                    out.write(`${msg}\n`);
                } catch {
                    // fallback: attempt to write to stderr
                    try {
                        console.error(msg);
                    } catch {
                        // give up silently
                    }
                }
            } else {
                try {
                    console.error(msg);
                } catch {
                    // ignore
                }
            }
        };
        process.once('beforeExit', () => show());
        process.once('SIGINT', () => {
            show('終了処理中… (Ctrl+C)');
            process.exit(130);
        });
        process.once('SIGTERM', () => {
            show('終了処理中…');
            process.exit(143);
        });
    };

    const args = process.argv.slice(2);
    const cmd = args[0];
    if (cmd === 'login') {
        const baseUrl = args[1];
        if (!baseUrl) {
            // 最小限の使い方を表示
            console.error('Usage: misska login <instance-url>\n  e.g. misska login https://misskey.io');
            process.exitCode = 1;
            return;
        }
        setupExitBanner();
        render(<LoginApp baseUrl={baseUrl} />);
        return;
    }
    if (cmd === 'account' || cmd === 'accounts') {
        printAccounts();
        return;
    }
    if (cmd === 'use') {
        runUseCommand(args.slice(1).join(' ').trim() || undefined);
        return;
    }

    setupExitBanner();
    render(<DefaultApp />);
}

main();
