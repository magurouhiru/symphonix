import { json } from '@sveltejs/kit';
import { chat, modelInfo } from '#lib/server/model.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { prompt } = await request.json();
	if (typeof prompt !== 'string' || !prompt.trim()) {
		return json({ error: 'prompt is required' }, { status: 400 });
	}
	try {
		const reply = await chat([{ role: 'user', content: prompt }]);
		return json({ reply, model: modelInfo.model });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e), ...modelInfo }, { status: 502 });
	}
};
