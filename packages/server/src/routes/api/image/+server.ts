import { json } from '@sveltejs/kit';
import { generateImage, imageModelInfo } from '#lib/ai/image.server.js';
import type { RequestHandler } from './$types';
import { errorMessage } from '#lib/shared/errors.js';

export const POST: RequestHandler = async ({ request }) => {
	const { prompt, size } = await request.json();
	if (typeof prompt !== 'string' || !prompt.trim()) {
		return json({ error: 'prompt is required' }, { status: 400 });
	}
	try {
		const b64 = await generateImage(prompt, typeof size === 'string' ? size : undefined);
		return json({ b64, model: imageModelInfo.model });
	} catch (e) {
		return json({ error: errorMessage(e), ...imageModelInfo }, { status: 502 });
	}
};
