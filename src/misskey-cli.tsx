#!/usr/bin/env node
import { render, Text, Box } from 'ink';
import React, { useEffect, useState } from 'react';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import console from 'node:console';

import { MisskeyClient } from './api/client.js';
import { buildMiAuthUrl, pollMiAuthToken } from './api/miauth.js';
// import { getMe } from './api/auth.js';
import { getConfig, setCurrentAccount, findAccountById, type AccountInfo } from './config/appConfig.js';
import { saveToken, loadToken } from './config/secureStore.js';
import HomeTimeline from './components/HomeTimeline.js';

function LoginApp({ baseUrl }: { baseUrl: string }) {
    const [message, setMessage] = useState<string>('');

    useEffect(() => {
        (async () => {
            try {
                const sessionId = randomUUID();
                const url = buildMiAuthUrl(baseUrl, {
                    sessionId,
                    name: 'misska-cli',
                    permission: ['read:account', 'read:notes', 'write:notes']
                });
                setMessage(
                    `MiAuth URL を開いて承認してください:\n${url}\n要求権限: read:account, read:notes, write:notes\n承認を待機中... (キャンセル: Ctrl+C)`
                );

                const anonClient = new MisskeyClient({ baseUrl });
                const { token, user } = await pollMiAuthToken(anonClient, sessionId, { timeoutMs: 2 * 60 * 1000 });
                const acct = user.host ? `@${user.username}@${user.host}` : `@${user.username}`;
                // 永続化（MiAuthのuser情報を利用）
                const accountId = `${baseUrl}#${user.username}${user.host ? '@' + user.host : ''}`;
                const account: AccountInfo = {
                    id: accountId,
                    baseUrl,
                    username: user.username,
                    host: user.host ?? null
                };
                setCurrentAccount(account);
                await saveToken(accountId, token);
                setMessage(`ログイン成功: ${acct}`);
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

function DefaultApp() {
    const [message, setMessage] = useState<string>('');
    const [ready, setReady] = useState(false);
    const [ctx, setCtx] = useState<{ baseUrl: string; token: string } | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const cfg = getConfig();
                const acc = findAccountById(cfg.currentAccountId ?? null);
                if (!acc) {
                    setMessage('未ログインです。`misska login <instance-url>` を実行してください。');
                    return;
                }
                const token = await loadToken(acc.id);
                if (!token) {
                    setMessage('トークンが見つかりません。`misska login <instance-url>` を実行してください。');
                    return;
                }
                // トークン検証（/api/i -> read:accountが必要）
                const client = new MisskeyClient({ baseUrl: acc.baseUrl, token });
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                const { getMe } = await import('./api/auth.js');
                await getMe(client);
                setCtx({ baseUrl: acc.baseUrl, token });
                setMessage('');
                setReady(true);
            } catch (e) {
                const msg = (e as Error).message || 'unknown error';
                setMessage(
                    `エラー: ${msg}\n権限に read:account, read:notes, write:notes が含まれているか確認し、再ログインしてください: misska login <instance-url>`
                );
            }
        })();
    }, []);

    if (message && !ready) return <Text>{message}</Text>;
    if (!ctx) return <Text>初期化中…</Text>;
    return <HomeTimeline baseUrl={ctx.baseUrl} token={ctx.token} />;
}

function main() {
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
        render(<LoginApp baseUrl={baseUrl} />);
        return;
    }

    render(<DefaultApp />);
}

main();
