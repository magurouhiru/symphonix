// symphonix がモデルを使い分ける用途
export const roles = ['chat', 'image', 'stt', 'tts'] as const;
export type Role = (typeof roles)[number];

export const roleLabels: Record<Role, string> = {
	chat: '文章',
	image: '画像',
	stt: '文字起こし',
	tts: '読み上げ'
};
