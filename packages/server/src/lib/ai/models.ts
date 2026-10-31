// symphonix がモデルを使い分ける用途
export const roles = ['chat', 'translate', 'image', 'stt', 'tts'] as const;
export type Role = (typeof roles)[number];

export const roleLabels: Record<Role, string> = {
	chat: '文章',
	translate: '翻訳',
	image: '画像',
	stt: '文字起こし',
	tts: '読み上げ'
};

export type Recommendation = { id: string; note: string };

// 8GB VRAM で動かせる LocalAI ギャラリーのモデル。先頭が既定
export const recommended: Record<Role, Recommendation[]> = {
	chat: [
		{ id: 'gemma-4-e4b-it-qat-q4_0', note: '軽くて速い。日本語も十分' },
		{ id: 'qwen3.8-9b-q4', note: '計画やコードに強い。少し重い' },
		{ id: 'gemma-4-12b-it-qat-q4_0', note: '日本語が一番自然。8GB ではぎりぎり' }
	],
	// 日本語が苦手なモデルを使うペルソナの入出力を訳す
	translate: [
		{ id: 'gemma-4-e4b-it-qat-q4_0', note: '軽くて速い。文章用と同じなら入れ替えが起きない' },
		{ id: 'gemma-4-12b-it-qat-q4_0', note: '訳が一番自然。8GB ではぎりぎり' }
	],
	image: [
		{ id: 'sd-1.5-ggml', note: '軽い。画質はそこそこ' },
		{ id: 'flux.2-klein-4b', note: '画質がかなり良い。おすすめ' },
		{ id: 'Z-Image-Turbo', note: '高画質で速い。少し重い' }
	],
	stt: [
		{ id: 'whisper-small', note: '軽くて速い' },
		{ id: 'whisper-medium', note: 'より正確。少し遅い' },
		{ id: 'whisper-large-q5_0', note: '一番正確。遅い' }
	],
	tts: [{ id: 'supertonic-3', note: '日本語で動作確認済み' }]
};
