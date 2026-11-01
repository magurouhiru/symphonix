import { json } from '@sveltejs/kit';
import { startRun } from '#lib/pipeline/orchestrator.server.js';
import { listRuns } from '#lib/pipeline/run-store.server.js';
import { errorMessage } from '#lib/shared/errors.js';
import type { RequestHandler } from './$types';

// これまでの実行の一覧（新しい順）
export const GET: RequestHandler = () => json({ runs: listRuns() });

// 承認したプランの実行を始める。進めるのはサーバーで、すぐに記録を返す
export const POST: RequestHandler = async ({ request }) => {
	const { request: want, steps, player, folder } = await request.json();
	if (typeof want !== 'string' || !Array.isArray(steps) || typeof player !== 'string' || typeof folder !== 'string') {
		return json({ error: 'request, steps, player and folder are required' }, { status: 400 });
	}
	try {
		return json(startRun({ request: want, steps, player, folder }));
	} catch (e) {
		return json({ error: errorMessage(e) }, { status: 400 });
	}
};
