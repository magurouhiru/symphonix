// AI ペルソナ: 名前と人物像（システムプロンプトに足す文章）と、使うモデル（空なら文章用のモデル）
export type Persona = { id: string; name: string; prompt: string; model: string };

// ペルソナに任せる作業
export const tasks = ['plan', 'code'] as const;
export type Task = (typeof tasks)[number];
export const taskLabels: Record<Task, string> = { plan: 'プラン作成', code: '実装' };

// レビュアー 1 人分の結果
export type Review = { persona: string; name: string; model: string; approved: boolean; comment: string };

// 指摘を受けて直す回数の上限。超えたら人が判断する
export const MAX_REVISIONS = 2;
