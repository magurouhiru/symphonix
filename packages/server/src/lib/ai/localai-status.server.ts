// LocalAI サーバーの死活と、各モデルのインストール・読み込み状態をまとめて取得する。
// symphonix が使うモデルが入っていなければ、LocalAI のギャラリーから取得させる
import { roleLabels, type Role } from './models.js';
import type { DownloadStatus, GpuStatus, ModelStatus, ServerState, StatusReport } from './status.js';
import { personaModels } from '#lib/personas/store.server.js';
import { roleModels } from './model-settings.server.js';
import { errorMessage } from '#lib/shared/errors.js';
import { LocalAIError, request, requestJson, STATUS_TIMEOUT_MS } from './localai.server.js';

// symphonix が今使っているモデル（設定画面で変わるので毎回読む）
function requiredModels(): string[] {
	return [...new Set([...Object.values(roleModels()), ...personaModels().map((p) => p.model)])];
}

// 失敗したダウンロードを再試行するまでの間隔
const RETRY_MS = 60_000;
// モデル名 → 依頼したダウンロードのジョブ。開発サーバーでモジュールが読み直されても
// 同じモデルを何度も依頼しないよう、globalThis に置く
const store = globalThis as typeof globalThis & {
	__symphonixRequested?: Map<string, { jobId: string; at: number }>;
};
const requested = (store.__symphonixRequested ??= new Map());

type Job = {
	gallery_element_name?: string;
	processed?: boolean;
	phase?: string;
	file_name?: string;
	progress?: number;
	message?: string;
	error?: string;
	downloaded_size?: string;
	file_size?: string;
	deletion?: boolean;
};

// /v1/models 以外も含め、すべて rootUrl からのパスで呼ぶ
const getJson = (path: string) => requestJson(path, { root: true, timeoutMs: STATUS_TIMEOUT_MS });

function parseReason(body: string): string | undefined {
	try {
		return JSON.parse(body).reason;
	} catch {
		return undefined;
	}
}

async function serverState(): Promise<{ server: ServerState; reason?: string }> {
	try {
		await request('/readyz', { root: true, timeoutMs: STATUS_TIMEOUT_MS });
		return { server: 'ready' };
	} catch (e) {
		// 返事はあるが準備中（503 など）なら starting。理由は本文の JSON にある
		if (e instanceof LocalAIError && e.status !== undefined) {
			return { server: 'starting', reason: parseReason(e.body ?? '') };
		}
		return { server: 'down', reason: errorMessage(e) };
	}
}

// そのモデルのジョブを探す。自分が依頼したジョブを優先し、なければ名前の一致で探す
// （LocalAI はダウンロード開始直後の一瞬、ジョブからモデル名を外して報告する）
function jobFor(id: string, jobs: Record<string, Job>): Job | undefined {
	const mine = requested.get(id);
	if (mine?.jobId && jobs[mine.jobId]) return jobs[mine.jobId];
	return Object.values(jobs).find(
		(j) => j.gallery_element_name === id && !j.processed && !j.deletion
	);
}

// 入っていない必須モデルのダウンロードを LocalAI に依頼する。進行中・直近に失敗したものは依頼しない
async function ensureModels(installed: string[], jobs: Record<string, Job>) {
	for (const id of requiredModels()) {
		if (installed.includes(id)) continue;
		const job = jobFor(id, jobs);
		if (job && !job.processed) continue;
		const mine = requested.get(id);
		if (mine && Date.now() - mine.at < RETRY_MS) continue;
		try {
			const job = await requestJson('/models/apply', { root: true, json: { id }, timeoutMs: STATUS_TIMEOUT_MS });
			requested.set(id, { jobId: job.uuid ?? '', at: Date.now() });
		} catch {
			// 次の確認で再試行する
		}
	}
}

// モデルごとのダウンロード状況。順番待ちは依頼した順に番号を振る
function downloadsFrom(installed: string[], jobs: Record<string, Job>): Map<string, DownloadStatus> {
	const result = new Map<string, DownloadStatus>();
	const pending = requiredModels()
		.filter((id) => !installed.includes(id))
		.map((id) => ({ id, job: jobFor(id, jobs) }))
		.filter((x): x is { id: string; job: Job } => !!x.job)
		.sort((a, b) => (requested.get(a.id)?.at ?? 0) - (requested.get(b.id)?.at ?? 0));
	let position = 0;
	for (const { id, job } of pending) {
		if (job.processed && !job.error) continue;
		const base = { progress: job.progress ?? 0, message: job.message || undefined };
		if (job.error) {
			result.set(id, { ...base, state: 'failed', error: job.error });
		} else if (job.phase === 'queued') {
			result.set(id, { ...base, state: 'queued', position: ++position });
		} else {
			result.set(id, {
				...base,
				state: 'downloading',
				file: job.file_name || undefined,
				downloaded: job.downloaded_size || undefined,
				total: job.file_size || undefined
			});
		}
	}
	return result;
}

export async function getStatus(): Promise<StatusReport> {
	const checkedAt = new Date().toISOString();
	const state = await serverState();
	if (state.server === 'down') {
		return { ...state, backends: [], gpus: [], models: modelsFrom([], [], new Map()), checkedAt };
	}
	// 起動中は一部の API が答えないことがあるので、取れたものだけ使う
	const [version, models, system, jobs, resources] = await Promise.allSettled([
		getJson('/version'),
		getJson('/v1/models'),
		getJson('/system'),
		getJson('/models/jobs'),
		getJson('/api/resources')
	]);
	const installed: string[] =
		models.status === 'fulfilled' ? (models.value.data ?? []).map((m: { id: string }) => m.id) : [];
	const loaded: { id: string; backend?: string }[] =
		system.status === 'fulfilled' ? (system.value.loaded_models ?? []) : [];
	const jobList: Record<string, Job> = jobs.status === 'fulfilled' ? (jobs.value ?? {}) : {};
	if (state.server === 'ready' && models.status === 'fulfilled') {
		await ensureModels(installed, jobList);
	}
	return {
		...state,
		version: version.status === 'fulfilled' ? version.value.version : undefined,
		backends: system.status === 'fulfilled' ? (system.value.backends ?? []).sort() : [],
		// モデルごとの VRAM は NVIDIA では取れないので、GPU 全体の使用量（nvidia-smi 由来）を返す
		gpus:
			resources.status === 'fulfilled'
				? (resources.value.gpus ?? []).map(
						(g: { name: string; used_vram: number; total_vram: number }): GpuStatus => ({
							name: g.name,
							usedBytes: g.used_vram,
							totalBytes: g.total_vram
						})
					)
				: [],
		models: modelsFrom(installed, loaded, downloadsFrom(installed, jobList)),
		checkedAt
	};
}

// symphonix が使うモデルを先に、それ以外のインストール済みモデルを後に並べる
function modelsFrom(
	installed: string[],
	loaded: { id: string; backend?: string }[],
	downloads: Map<string, DownloadStatus>
): ModelStatus[] {
	const current = roleModels();
	// LocalAI が返す順番は毎回変わるので、使っていないモデルは名前順に並べる
	const required = requiredModels();
	const others = installed.filter((id) => !required.includes(id)).sort();
	const ids = [...required, ...others];
	return ids.map((id) => {
		const live = loaded.find((m) => m.id === id);
		const isInstalled = installed.includes(id);
		return {
			id,
			roles: [
				...Object.entries(current)
					.filter(([, model]) => model === id)
					.map(([role]) => roleLabels[role as Role]),
				...personaModels()
					.filter((p) => p.model === id)
					.map((p) => `ペルソナ: ${p.name}`)
			],
			installed: isInstalled,
			loaded: !!live,
			backend: live?.backend,
			download: isInstalled ? undefined : downloads.get(id)
		};
	});
}
