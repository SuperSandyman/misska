import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import * as Misskey from 'misskey-js';
import process from 'node:process';
import tty from 'node:tty';
import { URL } from 'node:url';
import { fetch as undiciFetch } from 'undici';
import { getThemeColor, setThemeColor } from '../config/appConfig.js';
import { MisskeyClient } from '../api/client.js';

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

function formatNoteText(text: string | null | undefined): string {
    if (!text) return '(no text)';
    // 表示制限を設けず、改行をそのまま返す
    return text;
}

function formatUser(u?: TimelineNote['user']): string {
    if (!u) return '';
    const acct = u?.host ? `@${u?.username}@${u?.host}` : `@${u?.username}`;
    return u?.name ? `${u?.name} (${acct})` : acct;
}

export function HomeTimeline({ baseUrl, token }: { baseUrl: string; token: string }) {
    // 端末行数を取得
    const initialRows = (() => {
        const out = process.stdout as tty.WriteStream;
        return out && out.rows ? out.rows : 24;
    })();
    const [termRows, setTermRows] = useState<number>(initialRows);
    const notesRef = useRef<TimelineNote[]>([]);
    const [notes, setNotes] = useState<TimelineNote[]>([]);
    const [status, setStatus] = useState<string>('読み込み中…');
    const [input, setInput] = useState('');
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    // 入力欄やステータス行、エラー表示などを考慮して下部の確保行数を動的に算出
    const bottomReserved = 3 + (error ? 1 : 0) + (info ? 1 : 0);
    const [screen, setScreen] = useState<'timeline' | 'info'>('timeline');
    const [offset, setOffset] = useState<number>(0); // 先頭からのオフセット
    const [loadingMore, setLoadingMore] = useState<boolean>(false); // 追加読み込み中
    const [hasMore, setHasMore] = useState<boolean>(true); // さらに読み込み可能か
    const [colorsByHost, setColorsByHost] = useState<Record<string, string>>({});
    const { exit } = useApp();

    const api = useMemo(() => new Misskey.api.APIClient({ origin: baseUrl, credential: token }), [baseUrl, token]);
    // 直接HTTPクライアント（無限スクロール用）
    const httpClient = useMemo(() => new MisskeyClient({ baseUrl, token }), [baseUrl, token]);
    const streamRef = useRef<Misskey.Stream | null>(null);
    type MinimalChannel = { dispose?: () => void };
    const channelRef = useRef<MinimalChannel | null>(null);

    // 代替スクリーン（全画面）
    useEffect(() => {
    // notesRef を更新
    notesRef.current = notes;

        const out = process.stdout as tty.WriteStream;
        if (out && out.isTTY) {
            try {
                out.write('\x1b[?1049h'); // enable alt screen
            } catch {
                void 0;
            }
        }
        // 端末サイズ変化への追従
        const onResize = () => {
                const rows = out && out.rows ? out.rows : 24;
            setTermRows(rows);
            // オフセットを調整して、リサイズ後に表示が完全に空にならないようにする
            setOffset((prev) => {
                let off = prev;
                const newAvailable = Math.max(0, rows - bottomReserved);
                const measure = (idx: number) => {
                    const item = notesRef.current[idx];
                    if (!item) return 0;
                    return 1 + formatNoteText(item.text).split('\n').length + 1;
                };
                // オフセットが大きすぎて何も表示できない場合は少しずつ上に戻す
                while (off > 0) {
                    let used = 0;
                    let i = off;
                    while (i < notesRef.current.length && used + measure(i) <= newAvailable) {
                        used += measure(i);
                        i += 1;
                    }
                    if (used > 0) break;
                    off = Math.max(0, off - 1);
                }
                return off;
            });
        };
        try {
            out.on('resize', onResize);
        } catch {
            // ignore
        }
        return () => {
            if (out && out.isTTY) {
                try {
                    out.write('\x1b[?1049l'); // disable alt screen
                } catch {
                    void 0;
                }
            }
            try {
                out.removeListener('resize', onResize);
            } catch {
                // ignore
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

    // ノートソート関数：新しい順（降順）
    const sortNotesByDate = (notes: TimelineNote[]): TimelineNote[] => {
        return [...notes].sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA; // 降順（新しいものが先頭）
        });
    };

    // 初期ロード + ストリーミング購読
    useEffect(() => {
        let disposed = false;
        (async () => {
            try {
                const initial = await httpClient.post<TimelineNote[]>('notes/timeline', { limit: 50 });
                if (disposed) return;
                // 取得したノートを確実に新しい順でソート
                const sortedInitial = sortNotesByDate(initial);
                setNotes(sortedInitial);
                setStatus('');
                // 初期ロード時は必ず先頭から表示
                setOffset(0);
                // 初期読み込み分が50件未満の場合、これ以上読み込めない
                if (initial.length < 50) {
                    setHasMore(false);
                }
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
                        // 新しいノートを追加してソート
                        const withoutDuplicate = prev.filter((x) => x.id !== n.id);
                        const withNew = [n, ...withoutDuplicate];
                        const sorted = sortNotesByDate(withNew);
                        if (sorted.length > 100) sorted.length = 100;
                        return sorted;
                    });
                    // 新規ノート追加時：先頭表示中（offset=0）なら新しいノートが自動表示される
                    // スクロール中（offset>0）なら相対位置を維持するためoffsetを+1
                    // ただし、意図しないオフセットの蓄積を防ぐため、基本は0にリセット
                    setOffset(0);
                });
                stream.on('_disconnected_', () => {
                    setStatus('再接続中…');
                });
                stream.on('_connected_', () => {
                    setStatus('');
                });

                // デバッグ: WebSocket接続エラーは低レベルで発生するため、直接は取得困難
                // 代わりに定期的な接続状況チェックを追加
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

    // 追加読み込み関数
    const loadMoreNotes = async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const oldestNote = notes[notes.length - 1];
            const untilId = oldestNote?.id;
            const additional = await httpClient.post<TimelineNote[]>('notes/timeline', {
                limit: 30,
                untilId
            });

            if (additional.length === 0) {
                setHasMore(false);
            } else {
                setNotes((prev) => {
                    // 追加ノートと既存ノートを結合してソート
                    const combined = [...prev, ...additional];
                    return sortNotesByDate(combined);
                });
            }
        } catch (e) {
            const msg = (e as Error).message ?? String(e);
            setError(`追加読み込みに失敗: ${msg}`);
        } finally {
            setLoadingMore(false);
        }
    };

    // 行ベースの可視領域計算（下に入力欄等を固定表示するため余白を確保）
    const availableRows = Math.max(0, termRows - bottomReserved);
    const measureNoteLines = (n: TimelineNote) => {
        const lines = formatNoteText(n.text).split('\n');
        return 1 + lines.length + 1; // user header + body lines + spacer
    };
    const visibleCountForOffset = (off: number) => {
        let used = 0;
        let count = 0;
        for (let i = off; i < notes.length; i += 1) {
            const item = notes[i];
            if (!item) break;
            const need = measureNoteLines(item);
            if (used + need > availableRows) break;
            used += need;
            count += 1;
        }
        return Math.max(0, count);
    };
    const currentVisibleCount = visibleCountForOffset(offset);

    // キー入力でスクロール
    useInput((_, key) => {
        if (screen !== 'timeline') return;
        const maxOffset = Math.max(0, notes.length - 1);
        if (key.upArrow) {
            setOffset((prev) => Math.max(prev - 1, 0));
        } else if (key.downArrow) {
            const newOffset = Math.min(offset + 1, maxOffset);
            setOffset(newOffset);
            const reachEnd = newOffset + visibleCountForOffset(newOffset) >= notes.length - 5;
            if (reachEnd && hasMore && !loadingMore) loadMoreNotes();
        } else if (key.pageUp) {
            setOffset((prev) => Math.max(prev - Math.max(1, currentVisibleCount), 0));
        } else if (key.pageDown) {
            const step = Math.max(1, currentVisibleCount);
            const newOffset = Math.min(offset + step, maxOffset);
            setOffset(newOffset);
            const reachEnd = newOffset + visibleCountForOffset(newOffset) >= notes.length - 5;
            if (reachEnd && hasMore && !loadingMore) loadMoreNotes();
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
                            '  • /help     このヘルプを表示',
                            '  • /refresh  最新データを強制取得',
                            '  • /latest   最新ノート1件をJSON表示',
                            '  • /exit     アプリを終了',
                            '',
                            'ヒント: 画面は↑/↓/PgUp/PgDnでスクロール可能。ヘルプを閉じるには空の入力でEnter。'
                        ].join('\n')
                    );
                    setScreen('info');
                    return;
                }
                case '/refresh': {
                    setError(null);
                    setInfo('最新データを取得中...');
                    setScreen('info');
                    try {
                        const fresh = await httpClient.post<TimelineNote[]>('notes/timeline', { limit: 50 });
                        const sortedFresh = sortNotesByDate(fresh);
                        setNotes(sortedFresh);
                        setOffset(0);
                        setInfo(`最新データを取得しました (${fresh.length}件)`);
                        // 取得完了後は自動でTLに戻る
                        setScreen('timeline');
                        setInfo(null);
                    } catch (e) {
                        setInfo(`取得に失敗: ${(e as Error).message}`);
                    }
                    return;
                }
                case '/latest': {
                    setError(null);
                    setInfo('取得中...');
                    setScreen('info');
                    try {
                        const latest = await httpClient.fetchLatestNote();
                        setInfo(JSON.stringify(latest, null, 2) ?? 'null');
                    } catch (e) {
                        setInfo(`取得に失敗: ${(e as Error).message}`);
                    }
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
            // 投稿成功時：先頭表示に戻る（自分の投稿を確認しやすくする）
            setOffset(0);
        } catch (e) {
            const msg = (e as Error).message ?? String(e);
            setError(`投稿に失敗: ${msg}`);
        } finally {
            setPosting(false);
        }
    };

    return (
        <Box flexDirection="column">
            {/* タイムラインを上から詰めて描画。下部の入力欄は常に固定 */}
            {error ? (
                <Box>
                    <Text color="red">{error}</Text>
                </Box>
            ) : null}
            <Box flexDirection="column" flexGrow={1}>
                {screen === 'info' ? (
                    <Text color="cyan">{info ?? ''}</Text>
                ) : notes.length === 0 && !status ? (
                    <Text color="gray">ノートがありません</Text>
                ) : (
                    (() => {
                        const elems: React.ReactNode[] = [];
                        let used = 0;
                        for (let i = offset; i < notes.length; i += 1) {
                            const n = notes[i]!;
                            const baseHost = (() => {
                                try {
                                    return new URL(baseUrl).host;
                                } catch {
                                    return '';
                                }
                            })();
                            const host = n.user?.host ?? baseHost;
                            const c = (host && colorsByHost[host]) || undefined;
                            const header = c ? (
                                <Text key={`${n.id}-h`} color={c}>
                                    {formatUser(n.user)}
                                </Text>
                            ) : (
                                <Text key={`${n.id}-h`}>{formatUser(n.user)}</Text>
                            );
                            const lines = formatNoteText(n.text).split('\n');
                            const need = 1 + lines.length + 1;
                            if (used + need > availableRows) break;
                            elems.push(
                                <Box key={n.id} flexDirection="column" marginBottom={1}>
                                    {header}
                                    {lines.map((line, idx) => (
                                        <Text key={idx}>
                                            {idx === 0 ? '• ' : '  '}
                                            {line}
                                        </Text>
                                    ))}
                                </Box>
                            );
                            used += need;
                        }
                        // filler を追加して常に availableRows 行分を占有する
                        const remaining = Math.max(0, availableRows - used);
                        for (let r = 0; r < remaining; r += 1) {
                            elems.push(
                                <Text key={`_filler_${r}`}>
                                    {' '}
                                </Text>
                            );
                        }
                        return <>{elems}</>;
                    })()
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

            <Box>
                {status ? (
                    <Text dimColor>{status}</Text>
                ) : (
                    <Text dimColor>↑/↓/PgUp/PgDn でスクロール / Ctrl+C または /exit で終了</Text>
                )}
            </Box>
        </Box>
    );
}

export default HomeTimeline;
