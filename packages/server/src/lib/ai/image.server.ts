// LocalAI の OpenAI 互換 API で画像を生成する（文章と同じサーバー）
import { apiUrl, requestJson } from './localai.server.js';
import { roleModel } from './model-settings.server.js';

export async function generateImage(prompt: string, size = '512x512'): Promise<string> {
	const data = await requestJson('/images/generations', {
		json: { model: roleModel('image'), prompt, size, response_format: 'b64_json' }
	});
	const b64 = data.data?.[0]?.b64_json;
	if (typeof b64 !== 'string') {
		throw new Error(`画像が返ってきませんでした: ${JSON.stringify(data).slice(0, 500)}`);
	}
	return b64;
}

export const imageModelInfo = {
	baseUrl: apiUrl,
	get model() {
		return roleModel('image');
	}
};
