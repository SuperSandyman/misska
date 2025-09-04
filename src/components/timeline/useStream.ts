import { useEffect } from 'react';
import type React from 'react';
import * as Misskey from 'misskey-js';
import { channelForType, type TimelineType } from './endpoints.js';
import type { TimelineNote } from './utils.js';

type MinimalChannel = { dispose?: () => void; on?: (event: string, cb: (n: TimelineNote) => void) => void };

export const useTimelineStream = (params: {
    baseUrl: string;
    token: string;
    tlType: TimelineType;
    notesRef: React.MutableRefObject<TimelineNote[]>;
    offsetRef: React.MutableRefObject<number>;
    setNotes: (v: TimelineNote[] | ((p: TimelineNote[]) => TimelineNote[])) => void;
    setOffset: (v: number) => void;
    setStatus: (s: string) => void;
    setError: (u: ((p: string | null) => string | null) | string | null) => void;
    sortNotesByDate: (arr: TimelineNote[]) => TimelineNote[];
}) => {
    const { baseUrl, token, tlType, notesRef, offsetRef, setNotes, setOffset, setStatus, setError, sortNotesByDate } =
        params;

    useEffect(() => {
        let disposed = false;
        let stream: Misskey.Stream | null = null;
        let channel: MinimalChannel | null = null;
        try {
            stream = new Misskey.Stream(baseUrl, { token });
            const chName = channelForType(tlType);
            const chUnknown = (stream as unknown as { useChannel: (name: string) => unknown }).useChannel(chName);
            channel = chUnknown as MinimalChannel;

            channel.on?.('note', (n: TimelineNote) => {
                if (disposed) return;
                const prev = notesRef.current;
                const currentOffset = offsetRef.current;
                const anchorId = prev[currentOffset]?.id ?? null;

                const withoutDuplicate = prev.filter((x) => x.id !== n.id);
                const withNew = [n, ...withoutDuplicate];
                const sorted = sortNotesByDate(withNew);
                if (sorted.length > 100) sorted.length = 100;
                setNotes(sorted);
                if (currentOffset > 0 && anchorId) {
                    const newIdx = sorted.findIndex((x) => x.id === anchorId);
                    if (newIdx >= 0) setOffset(newIdx);
                } else {
                    setOffset(0);
                }
            });
            (stream as unknown as { on: (ev: string, cb: () => void) => void }).on('_disconnected_', () => {
                if (disposed) return;
                setStatus('再接続中…');
            });
            (stream as unknown as { on: (ev: string, cb: () => void) => void }).on('_connected_', () => {
                if (disposed) return;
                setStatus('');
            });
        } catch (e) {
            const msg = (e as Error).message ?? String(e);
            setError((prev) => prev ?? `Streaming接続に失敗: ${msg}`);
        }

        return () => {
            disposed = true;
            try {
                channel?.dispose?.();
            } catch {
                // ignore
            }
            try {
                stream?.close?.();
            } catch {
                // ignore
            }
        };
    }, [baseUrl, token, tlType]);
};
