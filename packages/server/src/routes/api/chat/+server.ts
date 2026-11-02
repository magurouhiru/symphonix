import { chat, modelInfo } from '#lib/ai/chat.server.js';
import type { RequestHandler } from './$types';
import { errorMessage } from '#lib/shared/errors.js';

export const POST: RequestHandler = async ({ request }) => {
	const { prompt } = await request.json();
	if (typeof prompt !== 'string' || !prompt.trim()) {
		return Response.json({ error: 'prompt is required' }, { status: 400 });
	}
	try {
		const reply = await chat([{ role: 'user', content: prompt }]);
		return Response.json({ reply, model: modelInfo.model });
	} catch (e) {
		return Response.json({ error: errorMessage(e), ...modelInfo }, { status: 502 });
	}
};
