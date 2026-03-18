import { useCallback } from 'react';
import type { TimelineNote } from './utils.js';
import { openAccount } from '../commands/account.js';
import type { CommandContext } from '../commands/types.js';
import { showAccounts } from '../commands/accounts.js';
import { help } from '../commands/help.js';
import { refresh } from '../commands/refresh.js';
import { latest } from '../commands/latest.js';
import { doExit } from '../commands/exit.js';
import { reaction as reactionCmd } from '../commands/reaction.js';
import { startPost } from '../commands/post.js';
import { useAccount } from '../commands/use.js';

export type UIMode = 'timeline' | 'command' | 'post' | 'reaction' | 'account';

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
    currentAccountId: string;
    openAccountSwitcher: () => void;
    switchAccount: (query: string) => Promise<void>;
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
        currentAccountId,
        openAccountSwitcher,
        switchAccount,
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
            const ctx: CommandContext = {
                currentAccountId,
                uiMode,
                setUiMode,
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
                apiRequest,
                fetchLatestNote,
                fetchFresh,
                openAccountSwitcher,
                switchAccount,
                exit
            };
            if (cmd === '/account') return await openAccount(ctx);
            if (cmd === '/accounts') return await showAccounts(ctx);
            if (cmd === '/use') return await useAccount(ctx, parts.slice(1).join(' '));
            if (cmd === '/post') return await startPost(ctx);
            if (cmd === '/reaction' || cmd === '/react') return await reactionCmd(ctx, parts.slice(1).join(' ').trim());
            if (cmd === '/help') return await help(ctx);
            if (cmd === '/refresh') return await refresh(ctx);
            if (cmd === '/latest') return await latest(ctx);
            if (cmd === '/exit') return await doExit(ctx);
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
    }, [
        uiMode,
        input,
        notes,
        offset,
        posting,
        sortNotesByDate,
        fetchFresh,
        fetchLatestNote,
        apiRequest,
        currentAccountId,
        openAccountSwitcher,
        switchAccount,
        exit
    ]);
};
