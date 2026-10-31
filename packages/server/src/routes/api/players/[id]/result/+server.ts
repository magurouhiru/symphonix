import { json } from '@sveltejs/kit';
import { submitResult } from '#lib/players/registry.server.js';
import type { RequestHandler } from './$types';

// プレイヤーが仕事の結果を返す。{ jobId, result } か { jobId, error }
export const POST: RequestHandler = async ({ params, request }) => {
	const { jobId, result, error } = await request.json();
	if (!submitResult(params.id, String(jobId), result, typeof error === 'string' ? error : undefined)) {
		return json({ error: 'unknown job' }, { status: 404 });
	}
	return json({ ok: true });
};
