// LocalAI の OpenAI 互換 API を呼び出す
const baseUrl = process.env.AI_BASE_URL ?? 'http://localai:8080/v1';
import { roleModel } from './model-settings.server.js';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

// model を省くと文章用のモデルを使う
export async function chat(messages: ChatMessage[], model = roleModel('chat')): Promise<string> {
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

export const modelInfo = {
	baseUrl,
	get model() {
		return roleModel('chat');
	}
};
