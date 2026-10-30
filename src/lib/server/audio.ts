// LocalAI の OpenAI 互換 API で文字起こしと読み上げをする（文章・画像と同じサーバー）
const baseUrl = process.env.AI_BASE_URL ?? 'http://localai:8080/v1';
const sttModel = process.env.STT_MODEL ?? 'whisper-small';
const ttsModel = process.env.TTS_MODEL ?? 'kokoros-ja';

export async function transcribe(audio: Blob, filename: string): Promise<string> {
	const form = new FormData();
	form.append('model', sttModel);
	form.append('language', 'ja');
	form.append('file', audio, filename);
	const res = await fetch(`${baseUrl}/audio/transcriptions`, { method: 'POST', body: form });
	if (!res.ok) {
		throw new Error(`AI server error ${res.status}: ${await res.text()}`);
	}
	const data = await res.json();
	return String(data.text ?? '').trim();
}

export async function speak(text: string): Promise<Response> {
	const res = await fetch(`${baseUrl}/audio/speech`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ model: ttsModel, input: text })
	});
	if (!res.ok) {
		throw new Error(`AI server error ${res.status}: ${await res.text()}`);
	}
	return res;
}

export const audioModelInfo = { baseUrl, sttModel, ttsModel };
