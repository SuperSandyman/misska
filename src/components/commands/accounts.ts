import { listAccounts, type AccountInfo } from '../../config/appConfig.js';
import type { CommandContext } from './types.js';

const formatLine = (account: AccountInfo, currentAccountId: string, index: number): string => {
    const marker = account.id === currentAccountId ? '(x)' : '( )';
    return `${marker} ${index}. ${account.label} -> ${account.baseUrl}`;
};

export const formatAccountsList = (currentAccountId: string): string => {
    const accounts = listAccounts();
    if (accounts.length === 0) {
        return '保存済みアカウントはありません。`misska login <instance-url>` を実行してください。';
    }

    return [
        '保存済みアカウント:',
        ...accounts.map((account, index) => formatLine(account, currentAccountId, index + 1)),
        '',
        'TUI: /account -> j/k -> Enter',
        'CLI: misska account / misska use <number|account>'
    ].join('\n');
};

export async function showAccounts(ctx: CommandContext): Promise<void> {
    ctx.setInfo(formatAccountsList(ctx.currentAccountId));
    ctx.setScreen('info');
    ctx.setUiMode('timeline');
}
