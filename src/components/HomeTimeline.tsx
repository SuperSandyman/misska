import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import * as Misskey from 'misskey-js';
import process from 'node:process';
import tty from 'node:tty';
import { URL } from 'node:url';
import { fetch as undiciFetch } from 'undici';
import { getThemeColor, setThemeColor } from '../config/appConfig.js';

type TimelineNote = {
    id: string;
    text?: string | null;
    createdAt?: string;
    user?: {
        username?: string;
        name?: string | null;
        host?: string | null;
    } | null;
};

function formatUser(u?: TimelineNote['user']): string {
    if (!u) return '';
    const acct = u?.host ? `@${u?.username}@${u?.host}` : `@${u?.username}`;
    return u?.name ? `${u?.name} (${acct})` : acct;
}

export function HomeTimeline({ baseUrl, token }: { baseUrl: string; token: string }) {
    const WINDOW_SIZE = 20; // TLの表示件数（簡易）
    const [notes, setNotes] = useState<TimelineNote[]>([]);
    const [status, setStatus] = useState<string>('読み込み中…');
    const [input, setInput] = useState('');
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [screen, setScreen] = useState<'timeline' | 'info'>('timeline');
    const [offset, setOffset] = useState<number>(0); // 先頭からのオフセット
    const [colorsByHost, setColorsByHost] = useState<Record<string, string>>({});
    const { exit } = useApp();

    const api = useMemo(() => new Misskey.api.APIClient({ origin: baseUrl, credential: token }), [baseUrl, token]);
    const streamRef = useRef<Misskey.Stream | null>(null);
    type MinimalChannel = { dispose?: () => void };
    const channelRef = useRef<MinimalChannel | null>(null);

    // 代替スクリーン（全画面）
    useEffect(() => {
        const out = process.stdout as tty.WriteStream;
        if (out && out.isTTY) {
            try {
                out.write('\x1b[?1049h'); // enable alt screen
            } catch {
                void 0;
            }
        }
        return () => {
            if (out && out.isTTY) {
                try {
                    out.write('\x1b[?1049l'); // disable alt screen
                } catch {
                    void 0;
                }
            }
        };
    }, []);

    // テーマカラー取得（キャッシュ→meta）
    useEffect(() => {
        (async () => {
            try {
                const url = new URL(baseUrl);
                const host = url.host;
                const cached = getThemeColor(host);
                if (cached) {
                    setColorsByHost((prev) => ({ ...prev, [host]: cached }));
                    return;
                }
                const meta = (await api.request('meta', { detail: false })) as { themeColor?: string };
                if (meta?.themeColor) {
                    setThemeColor(host, meta.themeColor);
                    setColorsByHost((prev) => ({ ...prev, [host]: meta.themeColor! }));
                }
            } catch {
                void 0;
            }
        })();
    }, [api, baseUrl]);

    // ノート内の各ホストのテーマカラーを（キャッシュを見つつ）補完
    useEffect(() => {
        const baseHost = (() => {
            try {
                return new URL(baseUrl).host;
            } catch {
                return '';
            }
        })();
        const hosts = new Set<string>();
        for (const n of notes) {
            const host = n.user?.host ?? baseHost;
            if (host) hosts.add(host);
        }
        (async () => {
            for (const host of hosts) {
                if (colorsByHost[host]) continue;
                const cached = getThemeColor(host);
                if (cached) {
                    setColorsByHost((prev) => ({ ...prev, [host]: cached }));
                    continue;
                }
                try {
                    const res = await undiciFetch(`https://${host}/api/meta`, {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ detail: false })
                    });
                    const data = (await res.json()) as { themeColor?: string };
                    if (data?.themeColor) {
                        setThemeColor(host, data.themeColor);
                        setColorsByHost((prev) => ({ ...prev, [host]: data.themeColor! }));
                    }
                } catch {
                    // ignore per-host failures
                    void 0;
                }
            }
        })();
    }, [notes, baseUrl, colorsByHost]);

    // 初期ロード + ストリーミング購読
    useEffect(() => {
        let disposed = false;
        (async () => {
            try {
                const initial = (await api.request('notes/timeline', { limit: 30 })) as TimelineNote[];
                if (disposed) return;
                setNotes(initial);
                setStatus('');
            } catch (e) {
                if (disposed) return;
                const msg = (e as Error).message ?? String(e);
                setStatus('');
                setError(
                    `TL取得に失敗: ${msg}\n` +
                        'ネットワーク/証明書/プロキシ設定をご確認ください。必要なら /help でコマンドを確認できます。'
                );
            }

            try {
                const stream = new Misskey.Stream(baseUrl, { token });
                streamRef.current = stream;
                const ch = stream.useChannel('homeTimeline' as unknown as keyof Misskey.Channels);
                channelRef.current = ch as unknown as MinimalChannel;
                ch.on('note', (n: TimelineNote) => {
                    setNotes((prev) => {
                        const next = [n, ...prev.filter((x) => x.id !== n.id)];
                        if (next.length > 100) next.length = 100;
                        return next;
                    });
                    // ビューが先頭以外にあるときは、新規ノート分だけオフセットを進めて視点を維持
                    setOffset((prev) => (prev > 0 ? prev + 1 : 0));
                });
                stream.on('_disconnected_', () => setStatus('再接続中…'));
                stream.on('_connected_', () => setStatus(''));
            } catch (e) {
                if (disposed) return;
                const msg = (e as Error).message ?? String(e);
                setError((prev) => prev ?? `Streaming接続に失敗: ${msg}`);
            }
        })();

        return () => {
            disposed = true;
            try {
                channelRef.current?.dispose?.();
            } catch {
                // ignore cleanup error
            }
            try {
                streamRef.current?.close?.();
            } catch {
                // ignore cleanup error
            }
        };
    }, [api, baseUrl, token]);

    // キー入力でスクロール
    useInput((_, key) => {
        if (screen !== 'timeline') return;
        const maxOffset = Math.max(0, notes.length - WINDOW_SIZE);
        if (key.upArrow) {
            setOffset((prev) => Math.min(prev + 1, maxOffset));
        } else if (key.downArrow) {
            setOffset((prev) => Math.max(prev - 1, 0));
        } else if (key.pageUp) {
            setOffset((prev) => Math.min(prev + WINDOW_SIZE, maxOffset));
        } else if (key.pageDown) {
            setOffset((prev) => Math.max(prev - WINDOW_SIZE, 0));
        }
    });

    const onSubmit = async () => {
        const text = input.trim();
        // 情報画面表示中は、空EnterでTLに戻る
        if (screen === 'info' && text === '') {
            setScreen('timeline');
            setInfo(null);
            setInput('');
            return;
        }
        if (!text) return;

        // コマンド処理
        if (text.startsWith('/')) {
            const [cmd] = text.split(/\s+/, 1);
            setInput('');
            setError(null);
            switch (cmd) {
                case '/help': {
                    setInfo(
                        [
                            '使い方:',
                            '  • 通常のテキストでノートを投稿（visibility: home）',
                            '  • /help  このヘルプを表示',
                            '  • /exit  アプリを終了',
                            '',
                            'ヒント: 画面は↑/↓/PgUp/PgDnでスクロール可能。ヘルプを閉じるには空の入力でEnter。'
                        ].join('\n')
                    );
                    setScreen('info');
                    return;
                }
                case '/exit': {
                    // Inkの終了APIを使用
                    exit();
                    return;
                }
                default: {
                    setError(`未知のコマンド: ${cmd}（/help を参照）`);
                    return;
                }
            }
        }

        if (posting) return;
        setPosting(true);
        setError(null);
        setInfo(null);
        try {
            // 既定でホーム公開に投稿
            await api.request('notes/create', { text, visibility: 'home' });
            setInput('');
        } catch (e) {
            const msg = (e as Error).message ?? String(e);
            setError(`投稿に失敗: ${msg}`);
        } finally {
            setPosting(false);
        }
    };

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text>ホームタイムライン（最新100件・ライブ更新）</Text>
                {status ? <Text> - {status}</Text> : null}
            </Box>

            <Box flexDirection="column" marginBottom={1}>
                {error ? <Text color="red">{error}</Text> : null}
                {screen === 'info' ? (
                    <Text color="cyan">{info ?? ''}</Text>
                ) : notes.length === 0 && !status ? (
                    <Text color="gray">ノートがありません</Text>
                ) : (
                    <>
                        {(() => {
                            const maxOffset = Math.max(0, notes.length - WINDOW_SIZE);
                            const start = Math.min(offset, maxOffset);
                            const end = Math.min(start + WINDOW_SIZE, notes.length);
                            const windowNotes = notes.slice(start, end);
                            return (
                                <>
                                    {windowNotes.map((n) => (
                                        <Box key={n.id} flexDirection="column" marginBottom={1}>
                                            {(() => {
                                                const baseHost = (() => {
                                                    try {
                                                        return new URL(baseUrl).host;
                                                    } catch {
                                                        return '';
                                                    }
                                                })();
                                                const host = n.user?.host ?? baseHost;
                                                const c = (host && colorsByHost[host]) || undefined;
                                                return c ? (
                                                    <Text color={c}>{formatUser(n.user)}</Text>
                                                ) : (
                                                    <Text>{formatUser(n.user)}</Text>
                                                );
                                            })()}
                                            <Text>• {n.text ?? '(no text)'}</Text>
                                        </Box>
                                    ))}
                                    <Text dimColor>
                                        [{start + 1}-{end}/{notes.length}] ↑/↓/PgUp/PgDn でスクロール
                                    </Text>
                                </>
                            );
                        })()}
                    </>
                )}
            </Box>

            <Box borderStyle="round" borderColor="cyan" paddingX={1}>
                <Text>投稿/コマンド: </Text>
                <TextInput
                    value={input}
                    onChange={setInput}
                    onSubmit={onSubmit}
                    placeholder="ノート入力で投稿 / コマンド例: /help, /exit"
                />
                {posting ? <Text> 送信中…</Text> : null}
            </Box>

            <Box marginTop={1}>
                <Text dimColor>Ctrl+C または /exit で終了</Text>
            </Box>
        </Box>
    );
}

export default HomeTimeline;
