import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import process from 'node:process';
import tty from 'node:tty';
import { URL } from 'node:url';
// import { setTimeout as nodeSetTimeout } from 'node:timers';
import { fetch as undiciFetch } from 'undici';
import { getThemeColor, setThemeColor } from '../config/appConfig.js';
import { MisskeyClient } from '../api/client.js';
import { TimelineList } from './timeline/TimelineList.js';
import { measureNoteLines } from './timeline/utils.js';
import type { TimelineNote } from './timeline/utils.js';
import { fetchTimeline } from './timeline/data.js';
import { useTimelineStream } from './timeline/useStream.js';
import type { TimelineType } from './timeline/endpoints.js';
import { useAltScreen, useResizeWithOffsetGuard } from './timeline/useAltScreen.js';
import { useTimelineKeys } from './timeline/useKeys.js';
import { useCommandSubmit } from './timeline/useSubmit.js';

// TimelineNote 型や表示系ユーティリティは utils.ts に集約

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
    // 画面モード: タイムライン/情報オーバーレイ
    const [screen, setScreen] = useState<'timeline' | 'info'>('timeline');
    // 操作モード: タイムライン/コマンド/投稿/リアクション
    const [uiMode, setUiMode] = useState<'timeline' | 'command' | 'post' | 'reaction'>('timeline');
    // タイムライン種別
    const [tlType, setTlType] = useState<'home' | 'local' | 'social' | 'global'>('home');
    // 下部固定領域: ステータス1行 + （入力ボックス表示時は枠含め概算3行） + エラー行（上部表示だが簡易に減算）
    const bottomReserved = 1 + (uiMode === 'timeline' ? 0 : 3) + (error ? 1 : 0);
    const [offset, setOffset] = useState<number>(0); // 先頭からのオフセット
    const offsetRef = useRef<number>(0);
    useEffect(() => {
        offsetRef.current = offset;
    }, [offset]);
    const [loadingMore, setLoadingMore] = useState<boolean>(false); // 追加読み込み中
    const [hasMore, setHasMore] = useState<boolean>(true); // さらに読み込み可能か
    const [colorsByHost, setColorsByHost] = useState<Record<string, string>>({});
    const { exit } = useApp();

    // 直接HTTPクライアント（無限スクロール用）
    const httpClient = useMemo(() => new MisskeyClient({ baseUrl, token }), [baseUrl, token]);

    // 代替スクリーン（全画面） + リサイズ時のオフセット調整
    useAltScreen();
    useResizeWithOffsetGuard({
        bottomReserved,
        setTermRows,
        notesRef,
        setOffset,
        measure: (idx: number) => {
            const item = notesRef.current[idx];
            if (!item) return 0;
            return measureNoteLines(item);
        }
    });

    // notes が変化したら参照を更新（リサイズ時の計測で最新配列を使う）
    useEffect(() => {
        notesRef.current = notes;
    }, [notes]);

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
                const meta = (await httpClient.post<{ themeColor?: string }>('meta', { detail: false })) as {
                    themeColor?: string;
                };
                if (meta?.themeColor) {
                    setThemeColor(host, meta.themeColor);
                    setColorsByHost((prev) => ({ ...prev, [host]: meta.themeColor! }));
                }
            } catch {
                void 0;
            }
        })();
    }, [httpClient, baseUrl]);

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

    // 初期ロード
    useEffect(() => {
        let disposed = false;
        (async () => {
            try {
                // 切り替え時は状態を初期化
                setNotes([]);
                setHasMore(true);
                setOffset(0);
                setStatus('読み込み中…');
                const initial = await fetchTimeline(httpClient, tlType as TimelineType, 50);
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
        })();

        return () => {
            disposed = true;
        };
    }, [httpClient, tlType]);

    // ストリーミング購読（タイムライン種別に応じて張替え）
    useTimelineStream({
        baseUrl,
        token,
        tlType: tlType as TimelineType,
        notesRef,
        offsetRef,
        setNotes,
        setOffset,
        setStatus,
        setError,
        sortNotesByDate
    });

    // 追加読み込み関数
    const loadMoreNotes = async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const oldestNote = notes[notes.length - 1];
            const untilId = oldestNote?.id;
            const additional = await fetchTimeline(httpClient, tlType as TimelineType, 30, untilId);

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
    // キー入力（TLモード）
    useTimelineKeys({
        screen,
        setScreen,
        uiMode,
        setUiMode,
        input,
        setInput,
        notesLength: notes.length,
        offset,
        setOffset,
        hasMore,
        loadingMore,
        loadMoreNotes,
        visibleCountForOffset,
        setTlType,
        setStatus
    });

    const onSubmit = useCommandSubmit({
        uiMode,
        setUiMode,
        input,
        setInput,
        setError,
        setInfo,
        setScreen,
        setStatus,
        notes,
        offset,
        setNotes,
        sortNotesByDate,
        setOffset,
        posting,
        setPosting,
        apiRequest: (endpoint, body) => httpClient.post(endpoint, body),
        fetchLatestNote: () => httpClient.fetchLatestNote(),
        fetchFresh: (limit: number) => fetchTimeline(httpClient, tlType as TimelineType, limit),
        exit
    });

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
                    <TimelineList
                        notes={notes}
                        offset={offset}
                        availableRows={availableRows}
                        baseUrl={baseUrl}
                        colorsByHost={colorsByHost}
                    />
                )}
            </Box>

            {uiMode === 'command' ? (
                <Box borderStyle="round" borderColor="cyan" paddingX={1}>
                    <Text>コマンド: </Text>
                    <TextInput
                        value={input}
                        onChange={setInput}
                        onSubmit={onSubmit}
                        placeholder="/post, /reaction, /help, /exit, /refresh"
                    />
                </Box>
            ) : null}
            {uiMode === 'post' ? (
                <Box borderStyle="round" borderColor="green" paddingX={1}>
                    <Text>投稿: </Text>
                    <TextInput
                        value={input}
                        onChange={setInput}
                        onSubmit={onSubmit}
                        placeholder="Enterで投稿 / Escでキャンセル"
                    />
                    {posting ? <Text> 送信中…</Text> : null}
                </Box>
            ) : null}
            {uiMode === 'reaction' ? (
                <Box borderStyle="round" borderColor="yellow" paddingX={1}>
                    <Text>リアクション: </Text>
                    <TextInput
                        value={input}
                        onChange={setInput}
                        onSubmit={onSubmit}
                        placeholder=":emoji: や 絵文字を入力 / Escでキャンセル"
                    />
                </Box>
            ) : null}

            <Box>
                <Text dimColor>
                    TL:{' '}
                    {tlType === 'home'
                        ? 'Home'
                        : tlType === 'local'
                          ? 'Local'
                          : tlType === 'social'
                            ? 'Social'
                            : 'Global'}
                    {'  '}({`1:Home 2:Local 3:Social 4:Global`}){'  '}
                    {status ? ` ${status}` : '/ でコマンド / Ctrl+C で終了'}
                </Text>
            </Box>
        </Box>
    );
}

export default HomeTimeline;
