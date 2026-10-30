// Docker Model Runner の Diffusers エンジンで画像を生成する
const baseUrl =
	process.env.MODEL_RUNNER_IMAGE_URL ?? 'http://model-runner.docker.internal/engines/diffusers/v1';
const model = process.env.IMAGE_MODEL ?? 'ai/stable-diffusion:Q4';

export async function generateImage(prompt: string, size = '512x512'): Promise<string> {
	const res = await fetch(`${baseUrl}/images/generations`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ model, prompt, size })
	});
	if (!res.ok) {
		throw new Error(`Model Runner error ${res.status}: ${await res.text()}`);
	}
	const data = await res.json();
	const b64 = data.data?.[0]?.b64_json;
	if (typeof b64 !== 'string') {
		throw new Error(`画像が返ってきませんでした: ${JSON.stringify(data).slice(0, 500)}`);
	}
	return b64;
}

export const imageModelInfo = { baseUrl, model };
