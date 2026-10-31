import { json } from '@sveltejs/kit';
import { generateImage, imageModelInfo } from '#lib/ai/image.server.js';
import { translate } from '#lib/ai/translate.server.js';
import type { RequestHandler } from './$types';
import { errorMessage } from '#lib/shared/errors.js';

export const POST: RequestHandler = async ({ request }) => {
	const { prompt, size, translate: toEnglish } = await request.json();
	if (typeof prompt !== 'string' || !prompt.trim()) {
		return json({ error: 'prompt is required' }, { status: 400 });
	}
	try {
		// 画像のモデルは英語のほうが指示が通りやすいので、日本語なら翻訳用のモデルで英語にしてから渡す
		const used = toEnglish === false ? prompt : await translate(prompt, 'en');
		const b64 = await generateImage(used, typeof size === 'string' ? size : undefined);
		return json({ b64, model: imageModelInfo.model, prompt: used });
	} catch (e) {
		return json({ error: errorMessage(e), ...imageModelInfo }, { status: 502 });
	}
};
