import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

export function CommandInput(props: {
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
}) {
    const { value, onChange, onSubmit } = props;
    return (
        <Box borderStyle="round" borderColor="cyan" paddingX={1}>
            <Text>コマンド: </Text>
            <TextInput
                value={value}
                onChange={onChange}
                onSubmit={onSubmit}
                placeholder="/accounts, /use, /post, /reaction, /help, /exit, /refresh"
            />
        </Box>
    );
}

export default CommandInput;
