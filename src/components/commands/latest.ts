import type { CommandContext } from './types.js';

export async function latest(ctx: CommandContext): Promise<void> {
    ctx.setInfo('取得中...');
    ctx.setScreen('info');
    try {
        const latest = await ctx.fetchLatestNote();
        ctx.setInfo(JSON.stringify(latest, null, 2) ?? 'null');
    } catch (e) {
        ctx.setInfo(`取得に失敗: ${(e as Error).message}`);
    }
    ctx.setUiMode('timeline');
}

