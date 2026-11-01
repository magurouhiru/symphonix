// LocalAI への HTTP 呼び出しをまとめる。接続先・タイムアウト・エラーの形はここだけで決める
import { errorMessage } from '#lib/shared/errors.js';

// OpenAI 互換 API（/v1）。/readyz や /system など LocalAI 独自の API は /v1 の外にある
export const apiUrl = (process.env.AI_BASE_URL ?? 'http://localai:8080/v1').replace(/\/+$/, '');
export const rootUrl = apiUrl.replace(/\/v1$/, '');

// 生成（文章・画像・音声）は、モデルの読み込み待ちも含めて長めに待つ。状態の確認はすぐ諦める
export const GENERATE_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_SEC ?? 600) * 1000;
export const STATUS_TIMEOUT_MS = 5_000;

export class LocalAIError extends Error {
	constructor(
		message: string,
		// LocalAI が返事をしたときだけ入る（つながらない・タイムアウトなら undefined）
		readonly status?: number,
		readonly body?: string
	) {
		super(message);
		this.name = 'LocalAIError';
	}
}

type RequestOptions = {
	method?: 'GET' | 'POST';
	// json と form はどちらか一方。どちらかを渡すと POST になる
	json?: unknown;
	form?: FormData;
	timeoutMs?: number;
	// true なら /v1 の外（rootUrl）を呼ぶ
	root?: boolean;
};

// 呼び出して、成功した Response を返す。失敗・タイムアウト・つながらないときは LocalAIError を投げる
export async function request(path: string, options: RequestOptions = {}): Promise<Response> {
	const { json, form, timeoutMs = GENERATE_TIMEOUT_MS } = options;
	const url = `${options.root ? rootUrl : apiUrl}${path}`;
	let res: Response;
	try {
		res = await fetch(url, {
			method: options.method ?? (json !== undefined || form ? 'POST' : 'GET'),
			headers: json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
			body: json !== undefined ? JSON.stringify(json) : form,
			signal: AbortSignal.timeout(timeoutMs)
		});
	} catch (e) {
		throw toLocalAIError(e, path, timeoutMs);
	}
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new LocalAIError(`LocalAI がエラーを返しました（${path}、${res.status}）: ${body.slice(0, 2000)}`, res.status, body);
	}
	return res;
}

// 呼び出して、返ってきた JSON を返す
export async function requestJson<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
	const timeoutMs = options.timeoutMs ?? GENERATE_TIMEOUT_MS;
	const res = await request(path, options);
	try {
		return (await res.json()) as T;
	} catch (e) {
		throw toLocalAIError(e, path, timeoutMs);
	}
}

function toLocalAIError(e: unknown, path: string, timeoutMs: number): LocalAIError {
	if (e instanceof LocalAIError) return e;
	if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
		return new LocalAIError(`LocalAI が ${Math.round(timeoutMs / 1000)} 秒以内に返事をしませんでした（${path}）`);
	}
	if (e instanceof SyntaxError) {
		return new LocalAIError(`LocalAI の返事を JSON として読めませんでした（${path}）: ${e.message}`);
	}
	// fetch の「fetch failed」だけでは分からないので、原因（ECONNREFUSED など）を出す
	const cause = e instanceof Error && e.cause ? e.cause : e;
	return new LocalAIError(`LocalAI につながりません（${path}）: ${errorMessage(cause)}`);
}
