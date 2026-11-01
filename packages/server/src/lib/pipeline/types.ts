// プラン → 実装 → 自動チェック → レビューの流れで、画面とサーバーが共有する型

export type PlanStep = { title: string; description: string };

// 実装のあとに自動で走らせるチェック 1 つ分の結果
export type CheckResult = { name: string; ok: boolean; skipped?: boolean; output: string };

// レビュアー 1 人分の結果
export type Review = { persona: string; name: string; model: string; approved: boolean; comment: string };

// 指摘を受けて直す回数の上限。超えたら人が判断する
export const MAX_REVISIONS = 2;

// ---- 実行の記録（サーバーが進め、data/runs/<id>.json に残す。画面はこれを取りに行って表示する）

export type GeneratedFile = { path: string; content: string };

export type StepStatus =
	| 'pending'
	| 'running'
	| 'checking'
	| 'reviewing'
	| 'revising'
	| 'done'
	| 'rejected'
	| 'interrupted'
	| 'error';

// 実装 1 回ごとの記録。files はそのとき AI が返したファイル（直すたびの変化を追える）
export type Round = { files: GeneratedFile[]; checks: CheckResult[]; reviews: Review[] };

// files はこのステップで書いたファイルの最新の内容
export type StepResult = { status: StepStatus; files: GeneratedFile[]; rounds: Round[]; error?: string };

// running: 進行中 / waiting: 直しても通らず人の判断待ち / interrupted: サーバーの再起動で途中で止まった
export type RunState = 'running' | 'waiting' | 'done' | 'stopped' | 'interrupted' | 'error';

export type RunRecord = {
	id: string;
	createdAt: string;
	updatedAt: string;
	state: RunState;
	request: string;
	steps: PlanStep[];
	// どのプレイヤーの作業フォルダの、どのフォルダに作るか（直下なら ROOT_PROJECT）
	player: string;
	project: string;
	// 表示用の書き出し先
	projectPath: string;
	results: StepResult[];
};

// 一覧に出す分だけ
export type RunSummary = Pick<RunRecord, 'id' | 'createdAt' | 'updatedAt' | 'state' | 'request' | 'project'> & {
	steps: number;
	done: number;
};

export const statusLabel: Record<StepStatus, string> = {
	pending: '待機中',
	running: '実装中…',
	checking: '自動チェック中…',
	reviewing: 'レビュー中…',
	revising: '指摘を直しています…',
	done: '完了',
	rejected: `${MAX_REVISIONS} 回直しても通りませんでした`,
	interrupted: 'サーバーが再起動したので中断しました',
	error: '失敗'
};

export const runStateLabel: Record<RunState, string> = {
	running: '実行中',
	waiting: '判断待ち',
	done: '完了',
	stopped: '止めました',
	interrupted: '中断',
	error: '失敗'
};
