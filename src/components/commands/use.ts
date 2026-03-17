import type { CommandContext } from './types.js';

export async function useAccount(ctx: CommandContext, arg: string): Promise<void> {
    const target = arg.trim();
    if (!target) {
        ctx.setError('使い方: /use <account>');
        ctx.setUiMode('timeline');
        return;
    }

    try {
        await ctx.switchAccount(target);
        ctx.setInfo(`アカウントを切り替えました: ${target}`);
        ctx.setScreen('info');
    } catch (e) {
        ctx.setError((e as Error).message ?? 'アカウント切替に失敗しました');
    } finally {
        ctx.setUiMode('timeline');
    }
}
