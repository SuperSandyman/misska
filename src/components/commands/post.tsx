import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { CommandContext } from './types.js';

export async function startPost(ctx: CommandContext): Promise<void> {
    ctx.setUiMode('post');
}

export function PostInput(props: {
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    posting: boolean;
}) {
    const { value, onChange, onSubmit, posting } = props;
    return (
        <Box borderStyle="round" borderColor="green" paddingX={1}>
            <Text>投稿: </Text>
            <TextInput value={value} onChange={onChange} onSubmit={onSubmit} placeholder="Enterで投稿 / Escでキャンセル" />
            {posting ? <Text> 送信中…</Text> : null}
        </Box>
    );
}

