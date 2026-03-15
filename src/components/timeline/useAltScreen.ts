import { useEffect } from 'react';
import type React from 'react';
import process from 'node:process';
import tty from 'node:tty';

export const useAltScreen = () => {
    useEffect(() => {
        const out = process.stdout as tty.WriteStream;
        if (out && out.isTTY) {
            try {
                out.write('\x1b[?1049h'); // enable alt screen
                out.write('\x1b[2J\x1b[H');
            } catch {
                // ignore
            }
        }
        return () => {
            if (out && out.isTTY) {
                try {
                    out.write('\x1b[?1049l'); // disable alt screen
                } catch {
                    // ignore
                }
            }
        };
    }, []);
};

export const useResizeWithOffsetGuard = (params: {
    bottomReserved: number;
    setTermRows: (v: number) => void;
    notesRef: React.MutableRefObject<{ text?: string | null }[]>;
    setOffset: (fn: (prev: number) => number) => void;
    measure: (idx: number) => number;
}) => {
    const { bottomReserved, setTermRows, notesRef, setOffset, measure } = params;
    useEffect(() => {
        const out = process.stdout as tty.WriteStream;
        const onResize = () => {
            const rows = out && out.rows ? out.rows : 24;
            setTermRows(rows);
            setOffset((prev) => {
                let off = prev;
                const newAvailable = Math.max(0, rows - bottomReserved);
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
            try {
                out.removeListener('resize', onResize);
            } catch {
                // ignore
            }
        };
    }, [bottomReserved, setTermRows, notesRef, setOffset, measure]);
};
