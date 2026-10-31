import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// プレイヤーの VS Code 拡張機能を配る。別の devcontainer の VS Code のターミナルで
//   curl -fO http://<symphonix>:7373/symphonix-player.vsix && code --install-extension symphonix-player.vsix
// とすれば、そのコンテナに入る
const vsixPath = path.resolve(process.env.PLAYER_VSIX ?? '../vscode/dist/symphonix-player.vsix');

export const GET: RequestHandler = async () => {
	try {
		return new Response(await readFile(vsixPath), {
			headers: {
				'Content-Type': 'application/vsix',
				'Content-Disposition': 'attachment; filename="symphonix-player.vsix"',
				'Cache-Control': 'no-cache'
			}
		});
	} catch {
		error(404, `拡張機能がまだビルドされていません（pnpm build を実行してください）: ${vsixPath}`);
	}
};
