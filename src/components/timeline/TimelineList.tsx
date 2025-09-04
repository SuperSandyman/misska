import React from 'react';
import { Box, Text } from 'ink';
import type { TimelineNote } from './utils.js';
import { formatNoteText, formatUser } from './utils.js';
import { URL } from 'node:url';

export function TimelineList(props: {
    notes: TimelineNote[];
    offset: number;
    availableRows: number;
    baseUrl: string;
    colorsByHost: Record<string, string>;
}) {
    const { notes, offset, availableRows, baseUrl, colorsByHost } = props;
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

        const isFirst = i === offset && used === 0;
        if (isFirst) {
            if (availableRows <= 0) break;
            if (used === 0 && availableRows >= 2) {
                elems.push(<Text key={`${n.id}-top-pad`}> </Text>);
                used += 1;
            }
            elems.push(header);
            used += 1;

            const remainAfterHeader = availableRows - used;
            if (remainAfterHeader <= 0) break;

            const bodyFit = Math.min(lines.length, remainAfterHeader);
            for (let j = 0; j < bodyFit; j += 1) {
                const line = lines[j];
                elems.push(
                    <Text key={`${n.id}-b-${j}`}>
                        {j === 0 ? '• ' : '  '}
                        {line}
                    </Text>
                );
            }
            used += bodyFit;

            if (bodyFit === lines.length && used + 1 <= availableRows) {
                elems.push(<Text key={`${n.id}-sp`}> </Text>);
                used += 1;
            }
            continue;
        }

        const need = 1 + lines.length + 1; // header + body + spacer
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
    const remaining = Math.max(0, availableRows - used);
    for (let r = 0; r < remaining; r += 1) {
        elems.push(<Text key={`_filler_${r}`}> </Text>);
    }
    return <>{elems}</>;
}

export default TimelineList;
