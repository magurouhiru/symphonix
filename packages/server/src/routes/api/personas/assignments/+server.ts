import { tasks, type Task } from '#lib/personas/types.js';
import { assign } from '#lib/personas/store.server.js';
import type { RequestHandler } from './$types';
import { errorMessage } from '#lib/shared/errors.js';

// { task, persona } で作業の担当ペルソナを変える
export const PUT: RequestHandler = async ({ request }) => {
	const { task, persona } = await request.json();
	if (!tasks.includes(task) || typeof persona !== 'string') {
		return Response.json({ error: 'task and persona are required' }, { status: 400 });
	}
	try {
		assign(task as Task, persona);
		return Response.json({ ok: true });
	} catch (e) {
		return Response.json({ error: errorMessage(e) }, { status: 400 });
	}
};
