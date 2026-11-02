import { listProjects } from '#lib/players/workspace.server.js';
import type { RequestHandler } from './$types';
import { errorMessage } from '#lib/shared/errors.js';

// プレイヤーの作業フォルダにあるプロジェクトの一覧（?player=プレイヤーの id）
export const GET: RequestHandler = async ({ url }) => {
	const player = url.searchParams.get('player');
	if (!player) return Response.json({ error: 'player is required' }, { status: 400 });
	try {
		return Response.json(await listProjects(player));
	} catch (e) {
		return Response.json({ error: errorMessage(e) }, { status: 502 });
	}
};
