import { useRef } from 'react';
import { useInput } from 'ink';
import type { TimelineType } from './endpoints.js';
import { setTimeout as nodeSetTimeout } from 'node:timers';

export const useTimelineKeys = (params: {
    screen: 'timeline' | 'info';
    setScreen: (s: 'timeline' | 'info') => void;
    uiMode: 'timeline' | 'command' | 'post' | 'reaction' | 'account';
    setUiMode: (m: 'timeline' | 'command' | 'post' | 'reaction' | 'account') => void;
    input: string;
    setInput: (s: string) => void;
    notesLength: number;
    offset: number;
    setOffset: (fn: number | ((prev: number) => number)) => void;
    hasMore: boolean;
    loadingMore: boolean;
    loadMoreNotes: () => void;
    visibleCountForOffset: (off: number) => number;
    setTlType: (t: TimelineType) => void;
    setStatus: (s: string) => void;
}) => {
    const {
        screen,
        setScreen,
        uiMode,
        setUiMode,
        // input is unused here but kept for API completeness
        setInput,
        notesLength,
        offset,
        setOffset,
        hasMore,
        loadingMore,
        loadMoreNotes,
        visibleCountForOffset,
        setTlType,
        setStatus
    } = params;

    const gAwaitRef = useRef<number | null>(null);

    useInput((inputChar, key) => {
        // 情報画面は Esc/Enter で閉じる
        if (screen === 'info') {
            if (key.escape || key.return) {
                setScreen('timeline');
            }
            return;
        }

        // コマンド/投稿モード中は Esc でキャンセルしてTLへ戻る
        if (uiMode !== 'timeline') {
            if (key.escape) {
                setUiMode('timeline');
                setInput('');
            }
            return;
        }

        const maxOffset = Math.max(0, notesLength - 1);
        const currentVisibleCount = visibleCountForOffset(offset);

        // 数字キーでタイムライン切替
        if (!key.ctrl && !key.meta && !key.shift) {
            if (inputChar === '1') {
                setTlType('home');
                setStatus('ホームTL');
                return;
            }
            if (inputChar === '2') {
                setTlType('local');
                setStatus('ローカルTL');
                return;
            }
            if (inputChar === '3') {
                setTlType('social');
                setStatus('ソーシャルTL');
                return;
            }
            if (inputChar === '4') {
                setTlType('global');
                setStatus('グローバルTL');
                return;
            }
        }

        // j/k
        if (inputChar === 'j') {
            const newOffset = Math.min(offset + 1, maxOffset);
            setOffset(newOffset);
            const reachEnd = newOffset + visibleCountForOffset(newOffset) >= notesLength - 5;
            if (reachEnd && hasMore && !loadingMore) loadMoreNotes();
            return;
        }
        if (inputChar === 'k') {
            setOffset((prev) => Math.max(prev - 1, 0));
            return;
        }

        // 矢印/Pageキー
        if (key.upArrow) {
            setOffset((prev) => Math.max(prev - 1, 0));
            return;
        }
        if (key.downArrow) {
            const newOffset = Math.min(offset + 1, maxOffset);
            setOffset(newOffset);
            const reachEnd = newOffset + visibleCountForOffset(newOffset) >= notesLength - 5;
            if (reachEnd && hasMore && !loadingMore) loadMoreNotes();
            return;
        }

        // Ctrl-f/Ctrl-b
        if (key.ctrl && inputChar === 'f') {
            setOffset((prev) => Math.max(prev - Math.max(1, currentVisibleCount), 0));
            return;
        }
        if (key.ctrl && inputChar === 'b') {
            const step = Math.max(1, currentVisibleCount);
            const newOffset = Math.min(offset + step, maxOffset);
            setOffset(newOffset);
            const reachEnd = newOffset + visibleCountForOffset(newOffset) >= notesLength - 5;
            if (reachEnd && hasMore && !loadingMore) loadMoreNotes();
            return;
        }
        if (key.pageUp) {
            setOffset((prev) => Math.max(prev - Math.max(1, currentVisibleCount), 0));
            return;
        }
        if (key.pageDown) {
            const step = Math.max(1, currentVisibleCount);
            const newOffset = Math.min(offset + step, maxOffset);
            setOffset(newOffset);
            const reachEnd = newOffset + visibleCountForOffset(newOffset) >= notesLength - 5;
            if (reachEnd && hasMore && !loadingMore) loadMoreNotes();
            return;
        }

        // gg (ダブル g)
        if (inputChar === 'g' && !key.ctrl && !key.meta) {
            const now = Date.now();
            const last = gAwaitRef.current;
            if (last && now - last < 600) {
                setOffset(0);
                gAwaitRef.current = null;
            } else {
                gAwaitRef.current = now;
                nodeSetTimeout(() => {
                    const l = gAwaitRef.current;
                    if (l && Date.now() - l >= 600) gAwaitRef.current = null;
                }, 650);
            }
            return;
        }

        // '/' でコマンドモードへ
        if (inputChar === '/') {
            setUiMode('command');
            setInput('/');
            return;
        }
    });
};
