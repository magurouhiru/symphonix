import { json } from '@sveltejs/kit';
import { tasks, type Task } from '#lib/personas.js';
import { assign } from '#lib/server/personas.js';
import type { RequestHandler } from './$types';

// { task, persona } で作業の担当ペルソナを変える
export const PUT: RequestHandler = async ({ request }) => {
	const { task, persona } = await request.json();
	if (!tasks.includes(task) || typeof persona !== 'string') {
		return json({ error: 'task and persona are required' }, { status: 400 });
	}
	try {
		assign(task as Task, persona);
		return json({ ok: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};
