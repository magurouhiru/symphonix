// LocalAI サーバーの死活と、各モデルのインストール・読み込み状態をまとめて取得する
import type { ModelStatus, ServerState, StatusReport } from '../status.js';

const baseUrl = process.env.AI_BASE_URL ?? 'http://localai:8080/v1';
// /readyz や /system は /v1 の外にある
const rootUrl = baseUrl.replace(/\/v1\/?$/, '');

// symphonix がどの用途でどのモデルを使っているか
const roles: Record<string, string | undefined> = {
	文章: process.env.MODEL ?? 'gemma-4-e4b-it-qat-q4_0',
	画像: process.env.IMAGE_MODEL ?? 'sd-1.5-ggml',
	文字起こし: process.env.STT_MODEL ?? 'whisper-small',
	読み上げ: process.env.TTS_MODEL ?? 'supertonic-3'
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

export async function getStatus(): Promise<StatusReport> {
	const checkedAt = new Date().toISOString();
	const state = await serverState();
	if (state.server === 'down') {
		return { ...state, backends: [], models: modelsFrom([], []), checkedAt };
	}
	// 起動中は一部の API が答えないことがあるので、取れたものだけ使う
	const [version, models, system] = await Promise.allSettled([
		getJson('/version'),
		getJson('/v1/models'),
		getJson('/system')
	]);
	const installed: string[] =
		models.status === 'fulfilled' ? (models.value.data ?? []).map((m: { id: string }) => m.id) : [];
	const loaded: { id: string; backend?: string; size_vram?: number }[] =
		system.status === 'fulfilled' ? (system.value.loaded_models ?? []) : [];
	return {
		...state,
		version: version.status === 'fulfilled' ? version.value.version : undefined,
		backends: system.status === 'fulfilled' ? (system.value.backends ?? []).sort() : [],
		models: modelsFrom(installed, loaded),
		checkedAt
	};
}

// symphonix が使うモデルを先に、それ以外のインストール済みモデルを後に並べる
function modelsFrom(
	installed: string[],
	loaded: { id: string; backend?: string; size_vram?: number }[]
): ModelStatus[] {
	const ids = [...new Set([...Object.values(roles).filter((id): id is string => !!id), ...installed])];
	return ids.map((id) => {
		const live = loaded.find((m) => m.id === id);
		return {
			id,
			roles: Object.entries(roles)
				.filter(([, model]) => model === id)
				.map(([role]) => role),
			installed: installed.includes(id),
			loaded: !!live,
			backend: live?.backend,
			vramBytes: live?.size_vram
		};
	});
}
