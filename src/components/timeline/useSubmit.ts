import { useCallback } from 'react';
import type { TimelineNote } from './utils.js';

export type UIMode = 'timeline' | 'command' | 'post' | 'reaction';

export const useCommandSubmit = (params: {
    uiMode: UIMode;
    setUiMode: (m: UIMode) => void;
    input: string;
    setInput: (s: string) => void;
    setError: (s: string | null) => void;
    setInfo: (s: string | null) => void;
    setScreen: (s: 'timeline' | 'info') => void;
    setStatus: (s: string) => void;
    notes: TimelineNote[];
    offset: number;
    setNotes: (v: TimelineNote[]) => void;
    sortNotesByDate: (arr: TimelineNote[]) => TimelineNote[];
    setOffset: (v: number) => void;
    posting: boolean;
    setPosting: (v: boolean) => void;
    apiRequest: <T = unknown>(endpoint: string, body?: unknown) => Promise<T>;
    fetchLatestNote: () => Promise<unknown | null>;
    fetchFresh: (limit: number) => Promise<TimelineNote[]>;
    exit: () => void;
}) => {
    const {
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
        apiRequest,
        fetchLatestNote,
        fetchFresh,
        exit
    } = params;

    return useCallback(async () => {
        const text = input.trim();
        if (uiMode === 'command') {
            if (!text) {
                setUiMode('timeline');
                setInput('');
                return;
            }
            const parts = text.split(/\s+/);
            const cmd = parts[0] ?? '';
            setInput('');
            setError(null);
            if (cmd === '/post') {
                setUiMode('post');
                return;
            }
            if (cmd === '/reaction' || cmd === '/react') {
                const reactionArg = parts.slice(1).join(' ').trim();
                if (reactionArg) {
                    try {
                        const target = notes[offset];
                        if (!target) throw new Error('リアクション対象のノートがありません');
                        await apiRequest('notes/reactions/create', { noteId: target.id, reaction: reactionArg });
                        setStatus(`リアクション送信: ${reactionArg}`);
                    } catch (e) {
                        const msg = (e as Error).message ?? String(e);
                        setError(`リアクションに失敗: ${msg}`);
                    }
                    setUiMode('timeline');
                } else {
                    setUiMode('reaction');
                }
                return;
            }
            if (cmd === '/help') {
                setInfo(
                    [
                        '使い方:',
                        '  • /post     投稿モードに入る',
                        '  • /reaction [絵文字]  先頭ノートにリアクション（例: /reaction ❤️ や /reaction :kusa:）',
                        '  • /refresh  最新データを強制取得',
                        '  • /latest   最新ノート1件をJSON表示',
                        '  • /exit     アプリを終了',
                        '',
                        '操作: 1/2/3/4でTL切替, j/k, Ctrl-f/Ctrl-b, gg, / でコマンドモード'
                    ].join('\n')
                );
                setScreen('info');
                setUiMode('timeline');
                return;
            }
            if (cmd === '/refresh') {
                setInfo('最新データを取得中...');
                setScreen('info');
                try {
                    const fresh = await fetchFresh(50);
                    const sortedFresh = sortNotesByDate(fresh);
                    setNotes(sortedFresh);
                    setOffset(0);
                    setInfo(`最新データを取得しました (${fresh.length}件)`);
                    setScreen('timeline');
                    setInfo(null);
                } catch (e) {
                    setInfo(`取得に失敗: ${(e as Error).message}`);
                }
                setUiMode('timeline');
                return;
            }
            if (cmd === '/latest') {
                setInfo('取得中...');
                setScreen('info');
                try {
                    const latest = await fetchLatestNote();
                    setInfo(JSON.stringify(latest, null, 2) ?? 'null');
                } catch (e) {
                    setInfo(`取得に失敗: ${(e as Error).message}`);
                }
                setUiMode('timeline');
                return;
            }
            if (cmd === '/exit') {
                exit();
                return;
            }
            setError(`未知のコマンド: ${cmd}（/help を参照）`);
            setUiMode('timeline');
            return;
        }

        if (uiMode === 'post') {
            if (!text) {
                setUiMode('timeline');
                setInput('');
                return;
            }
            if (posting) return;
            setPosting(true);
            setError(null);
            setInfo(null);
            try {
                await apiRequest('notes/create', { text, visibility: 'home' });
                setInput('');
                setOffset(0);
            } catch (e) {
                const msg = (e as Error).message ?? String(e);
                setError(`投稿に失敗: ${msg}`);
            } finally {
                setPosting(false);
                setUiMode('timeline');
            }
            return;
        }

        if (uiMode === 'reaction') {
            if (!text) {
                setUiMode('timeline');
                setInput('');
                return;
            }
            try {
                const target = notes[offset];
                if (!target) throw new Error('リアクション対象のノートがありません');
                await apiRequest('notes/reactions/create', { noteId: target.id, reaction: text });
                setStatus(`リアクション送信: ${text}`);
                setInput('');
            } catch (e) {
                const msg = (e as Error).message ?? String(e);
                setError(`リアクションに失敗: ${msg}`);
            } finally {
                setUiMode('timeline');
            }
            return;
        }
    }, [uiMode, input, notes, offset, posting, sortNotesByDate, fetchFresh, fetchLatestNote, apiRequest, exit]);
};
