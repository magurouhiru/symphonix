// LocalAI の OpenAI 互換 API を呼び出す
const baseUrl = process.env.AI_BASE_URL ?? 'http://localai:8080/v1';
const model = process.env.MODEL ?? 'gemma-4-e4b-it-qat-q4_0';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function chat(messages: ChatMessage[]): Promise<string> {
	const res = await fetch(`${baseUrl}/chat/completions`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ model, messages })
	});
	if (!res.ok) {
		throw new Error(`AI server error ${res.status}: ${await res.text()}`);
	}
	const data = await res.json();
	return data.choices?.[0]?.message?.content ?? '';
}

export const modelInfo = { baseUrl, model };
