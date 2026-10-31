import { json } from '@sveltejs/kit';
import { audioModelInfo, transcribe } from '#lib/server/audio.js';
import type { RequestHandler } from './$types';

// 録音した音声をそのまま本文で受け取り、文字に起こす
// （multipart にすると本番ビルドで SvelteKit の CSRF チェックに掛かるため）
export const POST: RequestHandler = async ({ request }) => {
	const audio = await request.blob();
	if (audio.size === 0) {
		return json({ error: 'audio is required' }, { status: 400 });
	}
	try {
		return json({ text: await transcribe(audio, 'audio.webm') });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e), ...audioModelInfo }, { status: 502 });
	}
};
