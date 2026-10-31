import { json } from '@sveltejs/kit';
import { createPlan } from '#lib/server/plan.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { request: want } = await request.json();
	if (typeof want !== 'string' || !want.trim()) {
		return json({ error: 'request is required' }, { status: 400 });
	}
	try {
		return json({ steps: await createPlan(want) });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
	}
};
