import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { CommandContext } from './types.js';

export async function reaction(ctx: CommandContext, arg: string | null): Promise<void> {
    if (arg && arg.trim()) {
        try {
            const target = ctx.notes[ctx.offset];
            if (!target) throw new Error('リアクション対象のノートがありません');
            await ctx.apiRequest('notes/reactions/create', { noteId: target.id, reaction: arg.trim() });
            ctx.setStatus(`リアクション送信: ${arg.trim()}`);
        } catch (e) {
            const msg = (e as Error).message ?? String(e);
            ctx.setError(`リアクションに失敗: ${msg}`);
        }
        ctx.setUiMode('timeline');
    } else {
        // 引数なしはリアクション入力モードへ
        ctx.setUiMode('reaction');
    }
}

export function ReactionInput(props: {
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
}) {
    const { value, onChange, onSubmit } = props;
    return (
        <Box borderStyle="round" borderColor="yellow" paddingX={1}>
            <Text>リアクション: </Text>
            <TextInput value={value} onChange={onChange} onSubmit={onSubmit} placeholder=":emoji: や 絵文字を入力 / Escでキャンセル" />
        </Box>
    );
}

