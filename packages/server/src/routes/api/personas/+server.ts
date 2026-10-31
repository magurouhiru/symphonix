import { json } from '@sveltejs/kit';
import { assignments, createPersona, listPersonas, reviewerIds } from '#lib/personas/store.server.js';
import { roleModel } from '#lib/ai/model-settings.server.js';
import type { RequestHandler } from './$types';
import { errorMessage } from '#lib/shared/errors.js';

// ペルソナの一覧と作業への割り当て。defaultModel はモデル未指定のペルソナが使うモデル
export const GET: RequestHandler = async () =>
	json({
		personas: listPersonas(),
		assignments: assignments(),
		reviewers: reviewerIds(),
		defaultModel: roleModel('chat')
	});

export const POST: RequestHandler = async ({ request }) => {
	try {
		return json({ persona: createPersona(await request.json()) });
	} catch (e) {
		return json({ error: errorMessage(e) }, { status: 400 });
	}
};
