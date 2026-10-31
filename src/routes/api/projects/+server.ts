import { json } from '@sveltejs/kit';
import { listProjects } from '#lib/server/workspace.js';
import type { RequestHandler } from './$types';

// クライアントの作業フォルダにあるプロジェクトの一覧（?client=クライアントの id）
export const GET: RequestHandler = async ({ url }) => {
	const client = url.searchParams.get('client');
	if (!client) return json({ error: 'client is required' }, { status: 400 });
	try {
		return json({ projects: await listProjects(client) });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
	}
};
