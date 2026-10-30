import { json } from '@sveltejs/kit';
import { generateImage, imageModelInfo } from '#lib/server/image.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { prompt, size } = await request.json();
	if (typeof prompt !== 'string' || !prompt.trim()) {
		return json({ error: 'prompt is required' }, { status: 400 });
	}
	try {
		const b64 = await generateImage(prompt, typeof size === 'string' ? size : undefined);
		return json({ b64, model: imageModelInfo.model });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e), ...imageModelInfo }, { status: 502 });
	}
};
