import { json } from '@sveltejs/kit';
import { checkProject } from '#lib/pipeline/checks.server.js';
import { targetFrom } from '#lib/players/target.server.js';
import type { RequestHandler } from './$types';
import { errorMessage } from '#lib/shared/errors.js';

// プロジェクトを自動チェックする（JSON や HTML の参照先、構文、npm install、build、test）
export const POST: RequestHandler = async ({ request }) => {
	const target = targetFrom(await request.json());
	if (!target) return json({ error: 'player and project are required' }, { status: 400 });
	try {
		return json({ checks: await checkProject(target) });
	} catch (e) {
		return json({ error: errorMessage(e) }, { status: 502 });
	}
};
