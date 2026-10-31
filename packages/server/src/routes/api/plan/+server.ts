import { json } from '@sveltejs/kit';
import { createPlan } from '#lib/pipeline/plan.server.js';
import { targetFrom } from '#lib/players/target.server.js';
import { checkProjectName } from '#lib/players/workspace.server.js';
import type { RequestHandler } from './$types';
import { errorMessage } from '#lib/shared/errors.js';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const want = body.request;
	if (typeof want !== 'string' || !want.trim()) {
		return json({ error: 'request is required' }, { status: 400 });
	}
	try {
		// player と project があれば、そのフォルダにある既存のプロジェクトを変えるプランにする
		const target = targetFrom(body);
		if (target) checkProjectName(target.project);
		return json({ steps: await createPlan(want, target ?? undefined) });
	} catch (e) {
		return json({ error: errorMessage(e) }, { status: 502 });
	}
};
