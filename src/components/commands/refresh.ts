import type { CommandContext } from './types.js';

export async function refresh(ctx: CommandContext): Promise<void> {
    ctx.setInfo('最新データを取得中...');
    ctx.setScreen('info');
    try {
        const fresh = await ctx.fetchFresh(50);
        const sortedFresh = ctx.sortNotesByDate(fresh);
        ctx.setNotes(sortedFresh);
        ctx.setOffset(0);
        ctx.setInfo(`最新データを取得しました (${fresh.length}件)`);
        ctx.setScreen('timeline');
        ctx.setInfo(null);
    } catch (e) {
        ctx.setInfo(`取得に失敗: ${(e as Error).message}`);
    }
    ctx.setUiMode('timeline');
}

