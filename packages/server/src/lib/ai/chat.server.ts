// LocalAI の OpenAI 互換 API で文章を生成する
import { apiUrl, requestJson } from './localai.server.js';
import { roleModel } from './model-settings.server.js';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

// model を省くと文章用のモデルを使う
export async function chat(messages: ChatMessage[], model = roleModel('chat')): Promise<string> {
	const data = await requestJson('/chat/completions', { json: { model, messages } });
	return data.choices?.[0]?.message?.content ?? '';
}

export const modelInfo = {
	baseUrl: apiUrl,
	get model() {
		return roleModel('chat');
	}
};
