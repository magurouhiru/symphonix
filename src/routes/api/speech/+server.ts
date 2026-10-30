import { json } from '@sveltejs/kit';
import { audioModelInfo, speak, ttsModels } from '#lib/server/audio.js';
import type { RequestHandler } from './$types';

// テキストを読み上げた音声をそのまま返す
export const POST: RequestHandler = async ({ request }) => {
	const { text, model } = await request.json();
	if (typeof text !== 'string' || !text.trim()) {
		return json({ error: 'text is required' }, { status: 400 });
	}
	try {
		const res = await speak(text, ttsModels.includes(model) ? model : undefined);
		return new Response(res.body, {
			headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'audio/wav' }
		});
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e), ...audioModelInfo }, { status: 502 });
	}
};
