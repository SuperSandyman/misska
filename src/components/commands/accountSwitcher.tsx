import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { listAccounts, type AccountInfo } from '../../config/appConfig.js';

export function AccountSwitcher(props: {
    currentAccountId: string;
    onCancel: () => void;
    onSelect: (query: string) => Promise<void>;
}) {
    const { currentAccountId, onCancel, onSelect } = props;
    const accounts = listAccounts();
    const initialIndex = Math.max(
        0,
        accounts.findIndex((account) => account.id === currentAccountId)
    );
    const [selectedIndex, setSelectedIndex] = useState(initialIndex);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setSelectedIndex(initialIndex);
    }, [initialIndex]);

    useInput(async (input, key) => {
        if (submitting) return;
        if (key.escape) {
            onCancel();
            return;
        }
        if (input === 'j' || key.downArrow) {
            setSelectedIndex((prev) => Math.min(prev + 1, Math.max(accounts.length - 1, 0)));
            return;
        }
        if (input === 'k' || key.upArrow) {
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
            return;
        }
        if (key.return) {
            const target = accounts[selectedIndex];
            if (!target) return;
            setSubmitting(true);
            try {
                await onSelect(String(selectedIndex + 1));
            } finally {
                setSubmitting(false);
            }
        }
    }, { isActive: true });

    if (accounts.length === 0) {
        return (
            <Box borderStyle="round" borderColor="yellow" flexDirection="column" paddingX={1}>
                <Text>保存済みアカウントはありません。</Text>
                <Text dimColor>Esc で閉じる / misska login &lt;instance-url&gt;</Text>
            </Box>
        );
    }

    return (
        <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={1}>
            <Text>アカウント選択</Text>
            {accounts.map((account: AccountInfo, index) => {
                const isSelected = index === selectedIndex;
                const isCurrent = account.id === currentAccountId;
                return (
                    <Text key={account.id} {...(isSelected ? { color: 'cyan' } : {})}>
                        {isSelected ? '>' : ' '} {isCurrent ? '(x)' : '( )'} {index + 1}. {account.label} {'->'}{' '}
                        {account.baseUrl}
                    </Text>
                );
            })}
            <Text dimColor>{submitting ? '切替中…' : 'j/k で移動, Enter で切替, Esc で閉じる'}</Text>
        </Box>
    );
}

export default AccountSwitcher;
