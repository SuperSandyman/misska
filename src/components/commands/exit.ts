import type { CommandContext } from './types.js';

export async function doExit(ctx: CommandContext): Promise<void> {
    ctx.exit();
}

