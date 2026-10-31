import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// 1 ファイルにまとめたプレイヤーを配る。別の環境では
//   curl -fO http://<symphonix>:7373/symphonix-player.js && node symphonix-player.js --server http://<symphonix>:7373 --root .
// だけで動く
const bundlePath = path.resolve(process.env.PLAYER_BUNDLE ?? '../player/dist/symphonix-player.js');

export const GET: RequestHandler = async () => {
	try {
		return new Response(await readFile(bundlePath), {
			headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' }
		});
	} catch {
		error(404, `プレイヤーがまだビルドされていません（pnpm build を実行してください）: ${bundlePath}`);
	}
};
