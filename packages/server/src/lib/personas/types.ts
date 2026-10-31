// AI ペルソナ: 名前と人物像（システムプロンプトに足す文章）と、使うモデル（空なら文章用のモデル）。
// translate を付けると、日本語が苦手なモデル向けに、日本語の入力を英語に、出力を日本語に訳す
export type Persona = { id: string; name: string; prompt: string; model: string; translate?: boolean };

// ペルソナに任せる作業
export const tasks = ['plan', 'code'] as const;
export type Task = (typeof tasks)[number];
export const taskLabels: Record<Task, string> = { plan: 'プラン作成', code: '実装' };
