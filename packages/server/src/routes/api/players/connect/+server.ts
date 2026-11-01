import { json } from '@sveltejs/kit';
import { registerPlayer } from '#lib/players/registry.server.js';
import type { RequestHandler } from './$types';

// プレイヤーの接続。{ name, host, root, allow } を受け取って id を返す
export const POST: RequestHandler = async ({ request }) => {
	const { name, host, root, allow } = await request.json();
	if (typeof name !== 'string' || typeof root !== 'string' || !Array.isArray(allow)) {
		return json({ error: 'name, root and allow are required' }, { status: 400 });
	}
	// host を送らない古いプレイヤーは、名前をホスト名の代わりにする
	const machine = typeof host === 'string' && host ? host : name;
	return json({ id: registerPlayer(name, machine, root, allow.map(String)) });
};
