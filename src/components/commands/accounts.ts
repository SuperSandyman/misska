import { listAccounts, type AccountInfo } from '../../config/appConfig.js';
import type { CommandContext } from './types.js';

const formatLine = (account: AccountInfo, currentAccountId: string): string => {
    const marker = account.id === currentAccountId ? '*' : ' ';
    return `${marker} ${account.label} -> ${account.baseUrl}`;
};

export const formatAccountsList = (currentAccountId: string): string => {
    const accounts = listAccounts();
    if (accounts.length === 0) {
        return '保存済みアカウントはありません。`misska login <instance-url>` を実行してください。';
    }

    return [
        '保存済みアカウント:',
        ...accounts.map((account) => formatLine(account, currentAccountId)),
        '',
        '切替: /use <account>',
        'CLI: misska use <account>'
    ].join('\n');
};

export async function showAccounts(ctx: CommandContext): Promise<void> {
    ctx.setInfo(formatAccountsList(ctx.currentAccountId));
    ctx.setScreen('info');
    ctx.setUiMode('timeline');
}
