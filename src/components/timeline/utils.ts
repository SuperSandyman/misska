// utils for timeline rendering

export type TimelineNote = {
    id: string;
    text?: string | null;
    createdAt?: string;
    user?: {
        username?: string;
        name?: string | null;
        host?: string | null;
    } | null;
};

export function formatNoteText(text: string | null | undefined): string {
    if (!text) return '(no text)';
    return text;
}

export function formatUser(u?: TimelineNote['user']): string {
    if (!u) return '';
    const acct = u?.host ? `@${u?.username}@${u?.host}` : `@${u?.username}`;
    return u?.name ? `${u?.name} (${acct})` : acct;
}

export const measureNoteLines = (n: TimelineNote): number => {
    const lines = formatNoteText(n.text).split('\n');
    return 1 + lines.length + 1; // header + body + spacer
};
