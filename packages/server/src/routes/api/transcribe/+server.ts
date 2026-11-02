import { audioModelInfo, transcribe } from '#lib/ai/audio.server.js';
import type { RequestHandler } from './$types';
import { errorMessage } from '#lib/shared/errors.js';

// 録音した音声をそのまま本文で受け取り、文字に起こす
// （multipart にすると本番ビルドで SvelteKit の CSRF チェックに掛かるため）
export const POST: RequestHandler = async ({ request }) => {
	const audio = await request.blob();
	if (audio.size === 0) {
		return Response.json({ error: 'audio is required' }, { status: 400 });
	}
	try {
		return Response.json({ text: await transcribe(audio, 'audio.webm') });
	} catch (e) {
		return Response.json({ error: errorMessage(e), ...audioModelInfo }, { status: 502 });
	}
};
