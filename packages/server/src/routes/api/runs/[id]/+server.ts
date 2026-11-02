import { json } from '@sveltejs/kit';
import { approveAnyway, resumeRun, stopRun } from '#lib/pipeline/orchestrator.server.js';
import { getRun } from '#lib/pipeline/run-store.server.js';
import { errorMessage } from '#lib/shared/errors.js';
import type { RequestHandler } from './$types';

// 実行の記録。画面はこれを数秒ごとに取りに来て表示する
export const GET: RequestHandler = ({ params }) => {
	const run = getRun(params.id);
	return run ? json(run) : json({ error: '実行が見つかりません' }, { status: 404 });
};

// 人の判断を伝える。approve: 差し戻されたまま次へ / stop: 止める / resume: 止まったステップからやり直す
const actions = { approve: approveAnyway, stop: stopRun, resume: resumeRun };

export const POST: RequestHandler = async ({ params, request }) => {
	const { action } = await request.json();
	const handler = actions[action as keyof typeof actions];
	if (!handler) return json({ error: 'action must be approve, stop or resume' }, { status: 400 });
	try {
		return json(handler(params.id));
	} catch (e) {
		return json({ error: errorMessage(e) }, { status: 400 });
	}
};
