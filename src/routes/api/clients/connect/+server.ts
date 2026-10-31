import { json } from '@sveltejs/kit';
import { registerClient } from '#lib/server/clients.js';
import type { RequestHandler } from './$types';

// クライアントの接続。{ name, root, allow } を受け取って id を返す
export const POST: RequestHandler = async ({ request }) => {
	const { name, root, allow } = await request.json();
	if (typeof name !== 'string' || typeof root !== 'string' || !Array.isArray(allow)) {
		return json({ error: 'name, root and allow are required' }, { status: 400 });
	}
	return json({ id: registerClient(name, root, allow.map(String)) });
};
