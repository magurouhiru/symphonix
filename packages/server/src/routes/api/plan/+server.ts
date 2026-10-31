import { json } from '@sveltejs/kit';
import { createPlan } from '#lib/pipeline/plan.server.js';
import type { RequestHandler } from './$types';
import { errorMessage } from '#lib/shared/errors.js';

export const POST: RequestHandler = async ({ request }) => {
	const { request: want } = await request.json();
	if (typeof want !== 'string' || !want.trim()) {
		return json({ error: 'request is required' }, { status: 400 });
	}
	try {
		return json({ steps: await createPlan(want) });
	} catch (e) {
		return json({ error: errorMessage(e) }, { status: 502 });
	}
};
