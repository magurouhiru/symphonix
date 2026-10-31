// クライアントの受付と、クライアントへの仕事の受け渡し。
// クライアントは /next に「次の仕事ある？」と聞きに来て（ロングポーリング）、終わったら /result に結果を返す
import { randomUUID } from 'node:crypto';
import type { ClientInfo } from '../clients.js';

type Job = { id: string; method: string; params: unknown };
type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout };
type Client = {
	id: string;
	name: string;
	root: string;
	allow: string[];
	lastSeen: number;
	queue: Job[];
	waiter?: (job: Job | null) => void;
	pending: Map<string, Pending>;
};

// クライアントが /next で待つ時間。これより長く間が空いたら切れたとみなす
const POLL_MS = 25_000;
const OFFLINE_MS = POLL_MS + 15_000;

// 開発サーバーでモジュールが読み直されても接続が消えないよう、globalThis に置く
const store = globalThis as typeof globalThis & { __symphonixClients?: Map<string, Client> };
const clients = (store.__symphonixClients ??= new Map());

const isConnected = (c: Client) => !!c.waiter || Date.now() - c.lastSeen < OFFLINE_MS;

export function registerClient(name: string, root: string, allow: string[]): string {
	// 同じフォルダのクライアントがつなぎ直したら、古いほうは消す
	for (const [id, c] of clients) {
		if (c.root === root && c.name === name) dropClient(id, 'クライアントがつなぎ直しました');
	}
	const id = randomUUID();
	clients.set(id, { id, name, root, allow, lastSeen: Date.now(), queue: [], pending: new Map() });
	return id;
}

function dropClient(id: string, reason: string) {
	const c = clients.get(id);
	if (!c) return;
	c.waiter?.(null);
	for (const p of c.pending.values()) {
		clearTimeout(p.timer);
		p.reject(new Error(reason));
	}
	clients.delete(id);
}

export function listClients(): ClientInfo[] {
	return [...clients.values()].map((c) => ({
		id: c.id,
		name: c.name,
		root: c.root,
		allow: c.allow,
		connected: isConnected(c)
	}));
}

// クライアントが次の仕事を待つ。仕事が無いまま POLL_MS たったら null。
// クライアントが落ちて待ちの接続が切れたら（signal）、すぐに切断扱いにする
export function nextJob(id: string, signal?: AbortSignal): Promise<Job | null> | undefined {
	const c = clients.get(id);
	if (!c) return undefined;
	c.lastSeen = Date.now();
	const job = c.queue.shift();
	if (job) return Promise.resolve(job);
	c.waiter?.(null);
	return new Promise((resolve) => {
		const timer = setTimeout(() => finish(null), POLL_MS);
		const abort = () => {
			finish(null);
			c.lastSeen = 0;
		};
		const finish = (j: Job | null) => {
			clearTimeout(timer);
			signal?.removeEventListener('abort', abort);
			if (c.waiter === finish) c.waiter = undefined;
			c.lastSeen = Date.now();
			resolve(j);
		};
		c.waiter = finish;
		signal?.addEventListener('abort', abort);
	});
}

export function submitResult(id: string, jobId: string, result: unknown, error?: string): boolean {
	const c = clients.get(id);
	const p = c?.pending.get(jobId);
	if (!c || !p) return false;
	c.lastSeen = Date.now();
	c.pending.delete(jobId);
	clearTimeout(p.timer);
	if (error) p.reject(new Error(error));
	else p.resolve(result);
	return true;
}

// クライアントに仕事を頼んで、結果を待つ
export function callClient<T>(id: string, method: string, params: unknown, timeoutMs = 60_000): Promise<T> {
	const c = clients.get(id);
	if (!c || !isConnected(c)) {
		return Promise.reject(new Error('クライアントがつながっていません。クライアントを起動してから選び直してください'));
	}
	const job: Job = { id: randomUUID(), method, params };
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			c.pending.delete(job.id);
			reject(new Error(`クライアントから返事がありません（${method}）`));
		}, timeoutMs);
		c.pending.set(job.id, { resolve: resolve as (v: unknown) => void, reject, timer });
		if (c.waiter) c.waiter(job);
		else c.queue.push(job);
	});
}
