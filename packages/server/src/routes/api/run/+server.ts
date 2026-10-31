import { json } from '@sveltejs/kit';
import { implementStep } from '#lib/pipeline/implement.server.js';
import { targetFrom } from '#lib/players/target.server.js';
import { checkProjectName } from '#lib/players/workspace.server.js';
import type { RequestHandler } from './$types';
import { errorMessage } from '#lib/shared/errors.js';

// プランの 1 ステップを実装し、プレイヤーの作業フォルダの project に書き出す
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { request: want, steps, index } = body;
	const target = targetFrom(body);
	if (typeof want !== 'string' || !Array.isArray(steps) || typeof index !== 'number' || !steps[index] || !target) {
		return json({ error: 'request, steps, index, player and project are required' }, { status: 400 });
	}
	try {
		checkProjectName(target.project);
		// feedback は自動チェックやレビュアーの指摘。あれば同じステップを直させる
		const feedback = typeof body.feedback === 'string' ? body.feedback : '';
		const files = await implementStep(target, want, steps, index, feedback);
		return json({ files });
	} catch (e) {
		return json({ error: errorMessage(e) }, { status: 502 });
	}
};
