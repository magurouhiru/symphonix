// LocalAI の OpenAI 互換 API で画像を生成する（文章と同じサーバー）
const baseUrl = process.env.AI_BASE_URL ?? 'http://localai:8080/v1';
const model = process.env.IMAGE_MODEL ?? 'sd-1.5-ggml';

export async function generateImage(prompt: string, size = '512x512'): Promise<string> {
	const res = await fetch(`${baseUrl}/images/generations`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ model, prompt, size, response_format: 'b64_json' })
	});
	if (!res.ok) {
		throw new Error(`AI server error ${res.status}: ${await res.text()}`);
	}
	const data = await res.json();
	const b64 = data.data?.[0]?.b64_json;
	if (typeof b64 !== 'string') {
		throw new Error(`画像が返ってきませんでした: ${JSON.stringify(data).slice(0, 500)}`);
	}
	return b64;
}

export const imageModelInfo = { baseUrl, model };
