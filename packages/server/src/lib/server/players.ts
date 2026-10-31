// プレイヤーの受付と、プレイヤーへの仕事の受け渡し。
// プレイヤーは /next に「次の仕事ある？」と聞きに来て（ロングポーリング）、終わったら /result に結果を返す
import { randomUUID } from 'node:crypto';
import { POLL_MS, type Job, type Method, type Methods, type PlayerInfo } from '@symphonix/protocol';

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout };
type Player = {
	id: string;
	name: string;
	root: string;
	allow: string[];
	lastSeen: number;
	queue: Job[];
	waiter?: (job: Job | null) => void;
	pending: Map<string, Pending>;
};

// /next の待ち（POLL_MS）より長く間が空いたら切れたとみなす
const OFFLINE_MS = POLL_MS + 15_000;

// 開発サーバーでモジュールが読み直されても接続が消えないよう、globalThis に置く
const store = globalThis as typeof globalThis & { __symphonixPlayers?: Map<string, Player> };
const players = (store.__symphonixPlayers ??= new Map());

const isConnected = (c: Player) => !!c.waiter || Date.now() - c.lastSeen < OFFLINE_MS;

export function registerPlayer(name: string, root: string, allow: string[]): string {
	// 同じフォルダのプレイヤーがつなぎ直したら、古いほうは消す
	for (const [id, c] of players) {
		if (c.root === root && c.name === name) dropPlayer(id, 'プレイヤーがつなぎ直しました');
	}
	const id = randomUUID();
	players.set(id, { id, name, root, allow, lastSeen: Date.now(), queue: [], pending: new Map() });
	return id;
}

function dropPlayer(id: string, reason: string) {
	const c = players.get(id);
	if (!c) return;
	c.waiter?.(null);
	for (const p of c.pending.values()) {
		clearTimeout(p.timer);
		p.reject(new Error(reason));
	}
	players.delete(id);
}

export function listPlayers(): PlayerInfo[] {
	return [...players.values()].map((c) => ({
		id: c.id,
		name: c.name,
		root: c.root,
		allow: c.allow,
		connected: isConnected(c)
	}));
}

// プレイヤーが次の仕事を待つ。仕事が無いまま POLL_MS たったら null。
// プレイヤーが落ちて待ちの接続が切れたら（signal）、すぐに切断扱いにする
export function nextJob(id: string, signal?: AbortSignal): Promise<Job | null> | undefined {
	const c = players.get(id);
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
	const c = players.get(id);
	const p = c?.pending.get(jobId);
	if (!c || !p) return false;
	c.lastSeen = Date.now();
	c.pending.delete(jobId);
	clearTimeout(p.timer);
	if (error) p.reject(new Error(error));
	else p.resolve(result);
	return true;
}

// プレイヤーに仕事を頼んで、結果を待つ
export function callPlayer<M extends Method>(
	id: string,
	method: M,
	params: Methods[M]['params'],
	timeoutMs = 60_000
): Promise<Methods[M]['result']> {
	type T = Methods[M]['result'];
	const c = players.get(id);
	if (!c || !isConnected(c)) {
		return Promise.reject(new Error('プレイヤーがつながっていません。プレイヤーを起動してから選び直してください'));
	}
	const job: Job = { id: randomUUID(), method, params };
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			c.pending.delete(job.id);
			reject(new Error(`プレイヤーから返事がありません（${method}）`));
		}, timeoutMs);
		c.pending.set(job.id, { resolve: resolve as (v: unknown) => void, reject, timer });
		if (c.waiter) c.waiter(job);
		else c.queue.push(job);
	});
}
