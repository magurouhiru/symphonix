// 画面側で実行の記録を見るためのもの。進めるのはサーバー（orchestrator.server.ts）で、
// ここは記録を数秒ごとに取りに行き、人の判断（承認・停止・再開）を伝えるだけ
import { postJson } from '#lib/shared/api.js';
import type { PlanStep, RunRecord } from './types.js';

export { statusLabel, runStateLabel } from './types.js';

const POLL_MS = 1500;

export type StartInput = { request: string; steps: PlanStep[]; player: string; folder: string };

export class PipelineRun {
	run = $state<RunRecord | null>(null);
	error = $state('');
	#timer: ReturnType<typeof setTimeout> | undefined;

	get running() {
		return this.run?.state === 'running';
	}
	get results() {
		return this.run?.results ?? [];
	}

	async start(input: StartInput) {
		this.#set(await postJson<RunRecord>('/api/runs', input));
	}

	// 前に始めた実行を開き直す（画面を閉じても、サーバーで進み続けている）
	async open(id: string) {
		const res = await fetch(`/api/runs/${encodeURIComponent(id)}`);
		if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
		this.#set(await res.json());
	}

	approveAnyway = () => this.#act('approve');
	stop = () => this.#act('stop');
	resume = () => this.#act('resume');

	// 画面を離れるときに呼ぶ（取りに行くのをやめるだけで、実行は止めない）
	dispose() {
		clearTimeout(this.#timer);
	}

	async #act(action: 'approve' | 'stop' | 'resume') {
		if (!this.run) return;
		this.#set(await postJson<RunRecord>(`/api/runs/${encodeURIComponent(this.run.id)}`, { action }));
	}

	#set(run: RunRecord) {
		this.run = run;
		this.error = '';
		clearTimeout(this.#timer);
		if (run.state === 'running') this.#timer = setTimeout(() => this.#poll(run.id), POLL_MS);
	}

	async #poll(id: string) {
		try {
			await this.open(id);
		} catch (e) {
			// サーバーの再起動中などは取れないので、少し待って取り直す
			this.error = e instanceof Error ? e.message : String(e);
			this.#timer = setTimeout(() => this.#poll(id), POLL_MS * 2);
		}
	}
}
