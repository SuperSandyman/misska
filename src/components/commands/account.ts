import type { CommandContext } from './types.js';

export async function openAccount(ctx: CommandContext): Promise<void> {
    ctx.setError(null);
    ctx.setInfo(null);
    ctx.setScreen('timeline');
    ctx.openAccountSwitcher();
}
