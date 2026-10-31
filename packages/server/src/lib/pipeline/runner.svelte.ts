// 承認したプランを 1 ステップずつ進める進行役（画面側で動く）。
// 実装 → 自動チェック → レビューを回し、エラーや指摘があれば直させる
import { postJson } from '#lib/shared/api.js';
import { errorMessage } from '#lib/shared/errors.js';
import { ROOT_PROJECT } from '#lib/shared/projects.js';
import { MAX_REVISIONS, type CheckResult, type PlanStep, type Review } from './types.js';

export type GeneratedFile = { path: string; content: string };
export type StepStatus = 'pending' | 'running' | 'checking' | 'reviewing' | 'revising' | 'done' | 'rejected' | 'error';
// 実装 1 回ごとの自動チェックとレビューの結果
export type Round = { checks: CheckResult[]; reviews: Review[] };
// files はこのステップで書いたファイル（最新の内容）
export type StepResult = { status: StepStatus; files: GeneratedFile[]; rounds: Round[]; error?: string };

export const statusLabel: Record<StepStatus, string> = {
	pending: '待機中',
	running: '実装中…',
	checking: '自動チェック中…',
	reviewing: 'レビュー中…',
	revising: '指摘を直しています…',
	done: '完了',
	rejected: `${MAX_REVISIONS} 回直しても通りませんでした`,
	error: '失敗'
};

// 実行に必要なもの。プランは実行中も画面で見られるよう、そのまま参照する
export type RunInput = {
	request: string;
	steps: PlanStep[];
	// どのプレイヤーの作業フォルダの、どのフォルダに作るか
	player: string;
	playerRoot: string;
	folder: string;
	hasReviewers: boolean;
};

export class PipelineRun {
	project = $state('');
	projectPath = $state('');
	results = $state<StepResult[]>([]);
	running = $state(false);
	#input: RunInput | null = null;

	// 承認したプランを最初から実装する。失敗や差し戻しがあればそこで止める
	start(input: RunInput) {
		this.#input = input;
		// フォルダ名を入れなければ日時にする
		this.project =
			input.folder.trim() || new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
		this.projectPath = this.project === ROOT_PROJECT ? input.playerRoot : `${input.playerRoot}/${this.project}`;
		this.results = input.steps.map(() => ({ status: 'pending', files: [], rounds: [] }));
		return this.#run(0);
	}

	// 差し戻されたステップを人が承認して、次のステップから続ける
	approveAnyway(i: number) {
		this.results[i].status = 'done';
		return this.#run(i + 1);
	}

	stop(i: number) {
		Object.assign(this.results[i], { status: 'error', error: 'ここで止めました' });
	}

	async #run(from: number) {
		const input = this.#input!;
		this.running = true;
		for (let i = from; i < input.steps.length; i++) {
			try {
				if (!(await this.#runStep(input, i))) break;
			} catch (e) {
				this.results[i].status = 'error';
				this.results[i].error = errorMessage(e);
				break;
			}
		}
		this.running = false;
	}

	// 1 ステップを実装し、自動チェックが通ってレビュアー全員が承認するまで、エラーや指摘を渡して直させる。
	// 直す回数の上限を超えたら rejected で止めて、人に判断してもらう
	async #runStep(input: RunInput, i: number): Promise<boolean> {
		const result = this.results[i];
		const target = { player: input.player, project: this.project };
		const step = { request: input.request, steps: input.steps, index: i };
		let feedback = '';
		for (let attempt = 0; attempt <= MAX_REVISIONS; attempt++) {
			result.status = attempt === 0 ? 'running' : 'revising';
			const { files } = await postJson<{ files: GeneratedFile[] }>('/api/run', {
				...step,
				...target,
				feedback,
				written: result.files.map((f) => f.path)
			});
			const byPath = new Map(result.files.map((f) => [f.path, f]));
			for (const f of files) byPath.set(f.path, f);
			result.files = [...byPath.values()];

			result.status = 'checking';
			const { checks } = await postJson<{ checks: CheckResult[] }>('/api/check', target);
			result.rounds.push({ checks, reviews: [] });
			const failed = checks.filter((c) => !c.ok);
			let reviews: Review[] = [];
			// 自動チェックで落ちたものはレビューせずに直させる
			if (failed.length === 0 && input.hasReviewers) {
				result.status = 'reviewing';
				({ reviews } = await postJson<{ reviews: Review[] }>('/api/review', {
					...step,
					...target,
					paths: result.files.map((f) => f.path)
				}));
				result.rounds[result.rounds.length - 1].reviews = reviews;
			}
			const rejected = reviews.filter((r) => !r.approved);
			if (failed.length === 0 && rejected.length === 0) break;
			if (attempt === MAX_REVISIONS) {
				result.status = 'rejected';
				return false;
			}
			feedback = [
				...failed.map((c) => `- 自動チェック「${c.name}」が失敗しました:\n${c.output}`),
				...rejected.map((r) => `- ${r.name}: ${r.comment}`)
			].join('\n');
		}
		result.status = 'done';
		return true;
	}
}
