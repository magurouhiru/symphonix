// Docker Model Runner の OpenAI 互換 API を呼び出す
const baseUrl = process.env.MODEL_RUNNER_URL ?? 'http://model-runner.docker.internal/engines/v1';
const model = process.env.MODEL ?? 'ai/smollm2';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function chat(messages: ChatMessage[]): Promise<string> {
	const res = await fetch(`${baseUrl}/chat/completions`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ model, messages })
	});
	if (!res.ok) {
		throw new Error(`Model Runner error ${res.status}: ${await res.text()}`);
	}
	const data = await res.json();
	return data.choices?.[0]?.message?.content ?? '';
}

export const modelInfo = { baseUrl, model };
