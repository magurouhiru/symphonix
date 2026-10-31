// プラン → 実装 → 自動チェック → レビューの流れで、画面とサーバーが共有する型

export type PlanStep = { title: string; description: string };

// 実装のあとに自動で走らせるチェック 1 つ分の結果
export type CheckResult = { name: string; ok: boolean; skipped?: boolean; output: string };

// レビュアー 1 人分の結果
export type Review = { persona: string; name: string; model: string; approved: boolean; comment: string };

// 指摘を受けて直す回数の上限。超えたら人が判断する
export const MAX_REVISIONS = 2;
