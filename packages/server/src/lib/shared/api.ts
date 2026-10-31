import { errorMessage } from './errors.js';

// 画面から symphonix の API に JSON を POST する。失敗したら API が返した error を投げる
export async function postJson<T>(url: string, body: unknown): Promise<T> {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	const data = await res.json().catch((e) => ({ error: errorMessage(e) }));
	if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
	return data as T;
}
