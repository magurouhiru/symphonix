// AI ペルソナ: 名前と人物像（システムプロンプトに足す文章）と、使うモデル（空なら文章用のモデル）
export type Persona = { id: string; name: string; prompt: string; model: string };

// ペルソナに任せる作業
export const tasks = ['plan', 'code'] as const;
export type Task = (typeof tasks)[number];
export const taskLabels: Record<Task, string> = { plan: 'プラン作成', code: '実装' };
