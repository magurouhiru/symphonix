// LocalAI の OpenAI 互換 API で文字起こしと読み上げをする（文章・画像と同じサーバー）
import { apiUrl, request, requestJson } from './localai.server.js';
import { roleModel } from './model-settings.server.js';

export async function transcribe(audio: Blob, filename: string): Promise<string> {
	const form = new FormData();
	form.append('model', roleModel('stt'));
	form.append('language', 'ja');
	form.append('file', audio, filename);
	const data = await requestJson('/audio/transcriptions', { form });
	return String(data.text ?? '').trim();
}

// 読み上げに向かない Markdown の記号や絵文字を落とす
function plainText(text: string): string {
	return text
		.replace(/```[\s\S]*?```/g, '')
		.replace(/[*_#`>|~\[\]()]/g, '')
		.replace(/\p{Extended_Pictographic}/gu, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export async function speak(text: string): Promise<Response> {
	return request('/audio/speech', {
		json: { model: roleModel('tts'), input: plainText(text), language: 'ja' }
	});
}

export const audioModelInfo = {
	baseUrl: apiUrl,
	get sttModel() {
		return roleModel('stt');
	},
	get ttsModel() {
		return roleModel('tts');
	}
};
