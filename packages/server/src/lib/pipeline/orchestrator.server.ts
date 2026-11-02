// 承認したプランを 1 ステップずつ進める進行役（サーバーで動く）。
// 実装 → 自動チェック → レビューを回し、エラーや指摘があれば直させる。
// 途中経過は毎回 data/runs に書き出すので、画面を閉じても進み続け、あとから見に来られる
import { reviewers } from '#lib/personas/store.server.js';
import { checkProjectName, newProjectName } from '#lib/players/workspace.server.js';
import { listPlayers } from '#lib/players/registry.server.js';
import { errorMessage } from '#lib/shared/errors.js';
import { ROOT_PROJECT } from '#lib/shared/projects.js';
import { checkProject } from './checks.server.js';
import { implementStep } from './implement.server.js';
import { reviewStep } from './review.server.js';
import { getRun, newRunId, saveRun } from './run-store.server.js';
import { MAX_REVISIONS, type PlanStep, type Review, type RunRecord } from './types.js';

// 進めている最中の実行。同じ実行を二重に進めないためと、止める依頼を伝えるため
const store = globalThis as typeof globalThis & { __symphonixDriving?: Map<string, { stop: boolean }> };
const driving = (store.__symphonixDriving ??= new Map());

class Stopped extends Error {}

export type StartInput = { request: string; steps: PlanStep[]; player: string; folder: string };

export function startRun(input: StartInput): RunRecord {
	const player = listPlayers().find((p) => p.id === input.player && p.connected);
	if (!player) throw new Error('プレイヤーがつながっていません。プレイヤーを起動してから選び直してください');
	if (input.steps.length === 0) throw new Error('プランが空です');
	// フォルダ名を入れなければ日時にする
	const project = checkProjectName(input.folder.trim() || newProjectName());
	const now = new Date().toISOString();
	const run: RunRecord = {
		id: newRunId(),
		createdAt: now,
		updatedAt: now,
		state: 'running',
		request: input.request,
		steps: input.steps.map((s) => ({ title: String(s.title), description: String(s.description) })),
		player: player.id,
		project,
		projectPath: project === ROOT_PROJECT ? player.root : `${player.root}/${project}`,
		results: input.steps.map(() => ({ status: 'pending', files: [], rounds: [] }))
	};
	saveRun(run);
	void drive(run, 0);
	return run;
}

// 差し戻されたステップを人が承認して、次のステップから続ける
export function approveAnyway(id: string): RunRecord {
	const run = mustGet(id);
	const i = run.results.findIndex((r) => r.status === 'rejected');
	if (run.state !== 'waiting' || i < 0) throw new Error('判断待ちのステップがありません');
	run.results[i].status = 'done';
	run.state = 'running';
	saveRun(run);
	void drive(run, i + 1);
	return run;
}

// 中断・失敗・判断待ちのステップを、もう一度そのステップからやり直す
export function resumeRun(id: string): RunRecord {
	const run = mustGet(id);
	if (driving.has(id) || run.state === 'running' || run.state === 'done') throw new Error('再開できる状態ではありません');
	const i = run.results.findIndex((r) => r.status !== 'done');
	if (i < 0) throw new Error('すべて完了しています');
	run.results[i].status = 'pending';
	run.results[i].error = undefined;
	run.state = 'running';
	saveRun(run);
	void drive(run, i);
	return run;
}

// 進行中なら今の作業（AI の返事など）が終わったところで止める。判断待ちならすぐ止める
export function stopRun(id: string): RunRecord {
	const run = mustGet(id);
	const active = driving.get(id);
	if (active) {
		active.stop = true;
	} else if (run.state === 'waiting') {
		const r = run.results.find((x) => x.status === 'rejected');
		if (r) Object.assign(r, { status: 'error', error: 'ここで止めました' });
		run.state = 'stopped';
		saveRun(run);
	}
	return run;
}

function mustGet(id: string): RunRecord {
	const run = getRun(id);
	if (!run) throw new Error(`実行が見つかりません: ${id}`);
	return run;
}

async function drive(run: RunRecord, from: number) {
	if (driving.has(run.id)) return;
	const control = { stop: false };
	driving.set(run.id, control);
	try {
		for (let i = from; i < run.steps.length; i++) {
			try {
				if (!(await runStep(run, i, control))) {
					run.state = 'waiting';
					return;
				}
			} catch (e) {
				const stopped = e instanceof Stopped;
				Object.assign(run.results[i], { status: 'error', error: stopped ? 'ここで止めました' : errorMessage(e) });
				run.state = stopped ? 'stopped' : 'error';
				return;
			}
		}
		run.state = 'done';
	} finally {
		driving.delete(run.id);
		saveRun(run);
	}
}

// 1 ステップを実装し、自動チェックが通ってレビュアー全員が承認するまで、エラーや指摘を渡して直させる。
// 直す回数の上限を超えたら rejected で止めて、人に判断してもらう
async function runStep(run: RunRecord, i: number, control: { stop: boolean }): Promise<boolean> {
	const result = run.results[i];
	const target = { player: run.player, project: run.project };
	// 状態を変えたら書き出す。止める依頼が来ていたらここで止める
	const set = (status: typeof result.status) => {
		if (control.stop) throw new Stopped();
		result.status = status;
		saveRun(run);
	};
	let feedback = '';
	for (let attempt = 0; attempt <= MAX_REVISIONS; attempt++) {
		set(attempt === 0 ? 'running' : 'revising');
		const files = await implementStep(
			target,
			run.request,
			run.steps,
			i,
			feedback,
			result.files.map((f) => f.path)
		);
		const byPath = new Map(result.files.map((f) => [f.path, f]));
		for (const f of files) byPath.set(f.path, f);
		result.files = [...byPath.values()];
		const round = { files, checks: [] as Awaited<ReturnType<typeof checkProject>>, reviews: [] as Review[] };
		result.rounds.push(round);

		set('checking');
		round.checks = await checkProject(target);
		const failed = round.checks.filter((c) => !c.ok);
		// 自動チェックで落ちたものはレビューせずに直させる
		if (failed.length === 0 && reviewers().length > 0) {
			set('reviewing');
			round.reviews = await reviewStep(
				target,
				run.request,
				run.steps,
				i,
				result.files.map((f) => f.path)
			);
		}
		const rejected = round.reviews.filter((r) => !r.approved);
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
	// 終わったものは止める依頼が来ていても完了にする
	result.status = 'done';
	saveRun(run);
	return true;
}
