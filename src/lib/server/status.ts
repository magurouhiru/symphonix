// LocalAI サーバーの死活と、各モデルのインストール・読み込み状態をまとめて取得する。
// symphonix が使うモデルが入っていなければ、LocalAI のギャラリーから取得させる
import type { DownloadStatus, ModelStatus, ServerState, StatusReport } from '../status.js';

const baseUrl = process.env.AI_BASE_URL ?? 'http://localai:8080/v1';
// /readyz や /system は /v1 の外にある
const rootUrl = baseUrl.replace(/\/v1\/?$/, '');

// symphonix がどの用途でどのモデルを使っているか
const roles: Record<string, string> = {
	文章: process.env.MODEL ?? 'gemma-4-e4b-it-qat-q4_0',
	画像: process.env.IMAGE_MODEL ?? 'sd-1.5-ggml',
	文字起こし: process.env.STT_MODEL ?? 'whisper-small',
	読み上げ: process.env.TTS_MODEL ?? 'supertonic-3'
};
const requiredModels = [...new Set(Object.values(roles))];

// 失敗したダウンロードを再試行するまでの間隔
const RETRY_MS = 60_000;
// モデル名 → このプロセスが依頼したダウンロードのジョブ
const requested = new Map<string, { jobId: string; at: number }>();

type Job = {
	gallery_element_name?: string;
	processed?: boolean;
	progress?: number;
	message?: string;
	error?: string;
	downloaded_size?: string;
	file_size?: string;
	deletion?: boolean;
};

async function getJson(path: string): Promise<any> {
	const res = await fetch(`${rootUrl}${path}`, { signal: AbortSignal.timeout(5000) });
	if (!res.ok) throw new Error(`${path}: ${res.status}`);
	return res.json();
}

async function serverState(): Promise<{ server: ServerState; reason?: string }> {
	try {
		const res = await fetch(`${rootUrl}/readyz`, { signal: AbortSignal.timeout(5000) });
		if (res.ok) return { server: 'ready' };
		const body = await res.json().catch(() => ({}));
		return { server: 'starting', reason: body.reason };
	} catch (e) {
		return { server: 'down', reason: e instanceof Error ? e.message : String(e) };
	}
}

// 入っていない必須モデルのダウンロードを LocalAI に依頼する。進行中・直近に失敗したものは依頼しない
async function ensureModels(installed: string[], jobs: Record<string, Job>) {
	for (const id of requiredModels) {
		if (installed.includes(id)) continue;
		const mine = requested.get(id);
		const job = mine && jobs[mine.jobId];
		if (job && !job.processed) continue;
		if (job?.error && Date.now() - mine!.at < RETRY_MS) continue;
		if (mine && !job && Date.now() - mine.at < RETRY_MS) continue;
		const running = Object.values(jobs).some(
			(j) => j.gallery_element_name === id && !j.processed && !j.deletion
		);
		if (running) continue;
		try {
			const res = await fetch(`${rootUrl}/models/apply`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id }),
				signal: AbortSignal.timeout(5000)
			});
			if (res.ok) requested.set(id, { jobId: (await res.json()).uuid ?? '', at: Date.now() });
		} catch {
			// 次の確認で再試行する
		}
	}
}

// ジョブ一覧からモデルごとの最新のダウンロード状況を取り出す
function downloadsFrom(jobs: Record<string, Job>): Map<string, DownloadStatus> {
	const result = new Map<string, DownloadStatus>();
	for (const [jobId, job] of Object.entries(jobs)) {
		const id = job.gallery_element_name;
		if (!id || job.deletion) continue;
		const mine = requested.get(id);
		// 自分が依頼したジョブがあればそれを優先し、なければ進行中のものだけ見る
		if (mine?.jobId ? mine.jobId !== jobId : job.processed && !job.error) continue;
		if (job.processed && !job.error) continue;
		result.set(id, {
			progress: job.progress ?? 0,
			downloaded: job.downloaded_size || undefined,
			total: job.file_size || undefined,
			message: job.message || undefined,
			error: job.error || undefined
		});
	}
	return result;
}

export async function getStatus(): Promise<StatusReport> {
	const checkedAt = new Date().toISOString();
	const state = await serverState();
	if (state.server === 'down') {
		return { ...state, backends: [], models: modelsFrom([], [], new Map()), checkedAt };
	}
	// 起動中は一部の API が答えないことがあるので、取れたものだけ使う
	const [version, models, system, jobs] = await Promise.allSettled([
		getJson('/version'),
		getJson('/v1/models'),
		getJson('/system'),
		getJson('/models/jobs')
	]);
	const installed: string[] =
		models.status === 'fulfilled' ? (models.value.data ?? []).map((m: { id: string }) => m.id) : [];
	const loaded: { id: string; backend?: string; size_vram?: number }[] =
		system.status === 'fulfilled' ? (system.value.loaded_models ?? []) : [];
	const jobList: Record<string, Job> = jobs.status === 'fulfilled' ? (jobs.value ?? {}) : {};
	if (state.server === 'ready' && models.status === 'fulfilled') {
		await ensureModels(installed, jobList);
	}
	return {
		...state,
		version: version.status === 'fulfilled' ? version.value.version : undefined,
		backends: system.status === 'fulfilled' ? (system.value.backends ?? []).sort() : [],
		models: modelsFrom(installed, loaded, downloadsFrom(jobList)),
		checkedAt
	};
}

// symphonix が使うモデルを先に、それ以外のインストール済みモデルを後に並べる
function modelsFrom(
	installed: string[],
	loaded: { id: string; backend?: string; size_vram?: number }[],
	downloads: Map<string, DownloadStatus>
): ModelStatus[] {
	const ids = [...new Set([...requiredModels, ...installed])];
	return ids.map((id) => {
		const live = loaded.find((m) => m.id === id);
		const isInstalled = installed.includes(id);
		return {
			id,
			roles: Object.entries(roles)
				.filter(([, model]) => model === id)
				.map(([role]) => role),
			installed: isInstalled,
			loaded: !!live,
			backend: live?.backend,
			vramBytes: live?.size_vram,
			download: isInstalled ? undefined : downloads.get(id)
		};
	});
}
