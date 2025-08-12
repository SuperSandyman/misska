import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import * as Misskey from 'misskey-js';

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
    const [notes, setNotes] = useState<TimelineNote[]>([]);
    const [status, setStatus] = useState<string>('読み込み中…');
    const [input, setInput] = useState('');
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const api = useMemo(() => new Misskey.api.APIClient({ origin: baseUrl, credential: token }), [baseUrl, token]);
    const streamRef = useRef<Misskey.Stream | null>(null);
    type MinimalChannel = { dispose?: () => void };
    const channelRef = useRef<MinimalChannel | null>(null);

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
                setError(`TL取得に失敗: ${msg}`);
            }

            try {
                const stream = new Misskey.Stream(baseUrl, { token });
                streamRef.current = stream;
                const ch = stream.useChannel('homeTimeline' as unknown as keyof Misskey.Channels);
                channelRef.current = (ch as unknown) as MinimalChannel;
                ch.on('note', (n: TimelineNote) => {
                    setNotes((prev) => {
                        const next = [n, ...prev.filter((x) => x.id !== n.id)];
                        if (next.length > 100) next.length = 100;
                        return next;
                    });
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

    const onSubmit = async () => {
        const text = input.trim();
        if (!text || posting) return;
        setPosting(true);
        setError(null);
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
                {status ? <Text>  - {status}</Text> : null}
            </Box>

            <Box flexDirection="column" marginBottom={1}>
                {error ? <Text color="red">{error}</Text> : null}
                {notes.length === 0 && !status ? (
                    <Text color="gray">ノートがありません</Text>
                ) : (
                    <>
                        {notes.map((n) => (
                            <Box key={n.id} flexDirection="column" marginBottom={1}>
                                <Text>{formatUser(n.user)}</Text>
                                <Text>• {n.text ?? '(no text)'}</Text>
                            </Box>
                        ))}
                    </>
                )}
            </Box>

            <Box borderStyle="round" borderColor="cyan" paddingX={1}>
                <Text>投稿: </Text>
                <TextInput
                    value={input}
                    onChange={setInput}
                    onSubmit={onSubmit}
                    placeholder="新しいノートを入力して Enter で投稿（visibility: home）"
                />
                {posting ? <Text>  送信中…</Text> : null}
            </Box>

            <Box marginTop={1}>
                <Text dimColor>Ctrl+C で終了</Text>
            </Box>
        </Box>
    );
}

export default HomeTimeline;
