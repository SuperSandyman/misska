import type { CommandContext } from './types.js';

export async function help(ctx: CommandContext): Promise<void> {
    ctx.setInfo(
        [
            '使い方:',
            '  • /post     投稿モードに入る',
            '  • /reaction [絵文字]  先頭ノートにリアクション（例: /reaction ❤️ や /reaction :kusa:）',
            '  • /refresh  最新データを強制取得',
            '  • /latest   最新ノート1件をJSON表示',
            '  • /exit     アプリを終了',
            '',
            '操作: 1/2/3/4でTL切替, j/k, Ctrl-f/Ctrl-b, gg, / でコマンドモード'
        ].join('\n')
    );
    ctx.setScreen('info');
    ctx.setUiMode('timeline');
}

