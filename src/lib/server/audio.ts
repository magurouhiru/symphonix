// LocalAI の OpenAI 互換 API で文字起こしと読み上げをする（文章・画像と同じサーバー）
const baseUrl = process.env.AI_BASE_URL ?? 'http://localai:8080/v1';
import { roleModel } from './settings.js';


export async function transcribe(audio: Blob, filename: string): Promise<string> {
	const form = new FormData();
	form.append('model', roleModel('stt'));
	form.append('language', 'ja');
	form.append('file', audio, filename);
	const res = await fetch(`${baseUrl}/audio/transcriptions`, { method: 'POST', body: form });
	if (!res.ok) {
		throw new Error(`AI server error ${res.status}: ${await res.text()}`);
	}
	const data = await res.json();
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
	const res = await fetch(`${baseUrl}/audio/speech`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ model: roleModel('tts'), input: plainText(text), language: 'ja' })
	});
	if (!res.ok) {
		throw new Error(`AI server error ${res.status}: ${await res.text()}`);
	}
	return res;
}

export const audioModelInfo = {
	baseUrl,
	get sttModel() {
		return roleModel('stt');
	},
	get ttsModel() {
		return roleModel('tts');
	}
};
