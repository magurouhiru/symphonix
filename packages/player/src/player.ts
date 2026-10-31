// symphonix のプレイヤー本体。symphonix に接続し、頼まれたファイル操作やコマンド実行を
// 指定したフォルダ（root）の中だけで行う。VS Code 拡張からもそのまま使えるよう、Node の標準機能だけで書く
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
	DEFAULT_ALLOW,
	IGNORED_DIRS,
	playerApi,
	type ConnectRequest,
	type ConnectResponse,
	type Entry,
	type Job,
	type JobReply,
	type Method,
	type Methods
} from '@symphonix/protocol';

// コマンドの出力は末尾だけ返す（エラーは最後に出ることが多いため）
const MAX_OUTPUT = 8000;
const ignored = new Set<string>(IGNORED_DIRS);

export type PlayerOptions = {
	// symphonix の URL（例: http://localhost:7373）
	server: string;
	// 作業フォルダ。この外は読み書きしない
	root: string;
	// symphonix の画面に出す名前。省くと作業フォルダの名前
	name?: string;
	// 実行してよいコマンド
	allow?: string[];
	log?: (message: string) => void;
	// つながった・切れたときに呼ぶ（VS Code のステータスバーなどに出す用）
	onStatus?: (status: PlayerStatus) => void;
};

export type PlayerStatus = 'connecting' | 'connected' | 'stopped';

type Handlers = { [M in Method]: (params: Methods[M]['params']) => Promise<Methods[M]['result']> };

class HttpError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

export function createHandlers(rootDir: string, allow: readonly string[]): Handlers {
	// root の外を指すパスは拒否する
	function resolveInside(relative = ''): string {
		const full = path.resolve(rootDir, relative);
		if (full !== rootDir && !full.startsWith(rootDir + path.sep)) {
			throw new Error(`作業フォルダの外は扱えません: ${relative}`);
		}
		return full;
	}

	return {
		async list({ dir = '', depth = Infinity }) {
			const start = resolveInside(dir);
			const entries: Entry[] = [];
			async function walk(current: string, level: number) {
				for (const entry of await readdir(current, { withFileTypes: true }).catch(() => [])) {
					if (ignored.has(entry.name)) continue;
					const full = path.join(current, entry.name);
					const rel = path.relative(start, full).split(path.sep).join('/');
					const info = await stat(full);
					if (entry.isDirectory()) {
						entries.push({ path: rel, type: 'dir', mtimeMs: info.mtimeMs });
						if (level + 1 < depth) await walk(full, level + 1);
					} else if (entry.isFile()) {
						entries.push({ path: rel, type: 'file', mtimeMs: info.mtimeMs, size: info.size });
					}
				}
			}
			await stat(start); // 無いフォルダはエラーにする
			await walk(start, 0);
			return { entries };
		},

		async read({ path: rel }) {
			return { base64: (await readFile(resolveInside(rel))).toString('base64') };
		},

		async write({ path: rel, content }) {
			const full = resolveInside(rel);
			await mkdir(path.dirname(full), { recursive: true });
			await writeFile(full, content);
			return { ok: true };
		},

		// シェルを通さず、許可したコマンドだけを実行する。時間切れのときはプロセスごと止める
		async run({ cwd = '', command, timeoutMs = 120_000 }) {
			if (!Array.isArray(command) || command.length === 0) throw new Error('command is required');
			if (!allow.includes(command[0])) throw new Error(`許可していないコマンドです: ${command[0]}`);
			const dir = resolveInside(cwd);
			const windows = process.platform === 'win32';
			return new Promise((resolve) => {
				const child = spawn(command[0], command.slice(1), {
					cwd: dir,
					env: { ...process.env, CI: '1', NO_COLOR: '1' },
					detached: !windows,
					shell: windows // Windows では npm が npm.cmd のため
				});
				let output = '';
				const append = (chunk: Buffer | string) => {
					output = (output + chunk).slice(-MAX_OUTPUT);
				};
				child.stdout.on('data', append);
				child.stderr.on('data', append);
				let timedOut = false;
				const timer = setTimeout(() => {
					timedOut = true;
					try {
						if (windows || !child.pid) child.kill();
						else process.kill(-child.pid, 'SIGKILL');
					} catch {
						// もう終わっている
					}
				}, timeoutMs);
				const finish = (code: number) => {
					clearTimeout(timer);
					resolve({ code, output, timedOut });
				};
				child.on('error', (e) => {
					append(String(e));
					finish(-1);
				});
				child.on('close', (code) => finish(code ?? -1));
			});
		}
	};
}

export function createPlayer({
	server,
	root,
	name,
	allow = [...DEFAULT_ALLOW],
	log = console.log,
	onStatus = () => {}
}: PlayerOptions) {
	const base = server.replace(/\/$/, '');
	const rootDir = path.resolve(root);
	const handlers = createHandlers(rootDir, allow);
	let stopped = true;
	let id = '';
	// 止めるときに待ち中の通信を打ち切る
	let abort = new AbortController();
	let running: Promise<void> | undefined;
	let status: PlayerStatus = 'stopped';
	function setStatus(next: PlayerStatus) {
		if (next === status) return;
		status = next;
		onStatus(next);
	}
	function wait(ms: number) {
		return new Promise<void>((resolve) => {
			const timer = setTimeout(resolve, ms);
			abort.signal.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true });
		});
	}

	async function api<T>(pathname: string, init?: RequestInit): Promise<T | null> {
		const res = await fetch(`${base}${pathname}`, {
			...init,
			headers: { 'Content-Type': 'application/json' },
			signal: abort.signal
		});
		if (res.status === 204) return null;
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new HttpError(data.error ?? `HTTP ${res.status}`, res.status);
		return data as T;
	}

	async function connect() {
		const body: ConnectRequest = { name: name ?? path.basename(rootDir), root: rootDir, allow };
		const data = await api<ConnectResponse>(playerApi.connect, { method: 'POST', body: JSON.stringify(body) });
		id = data!.id;
		log(`symphonix（${base}）に接続しました: ${rootDir}`);
	}

	async function handle(job: Job): Promise<JobReply> {
		try {
			const handler = handlers[job.method] as (params: unknown) => Promise<unknown>;
			if (!handler) throw new Error(`知らない仕事です: ${job.method}`);
			return { jobId: job.id, result: await handler(job.params ?? {}) };
		} catch (e) {
			return { jobId: job.id, error: e instanceof Error ? e.message : String(e) };
		}
	}

	function describe(job: Job): string {
		const p = job.params as { path?: string; dir?: string; command?: string[] };
		return `${job.method} ${p.path ?? p.dir ?? (p.command ?? []).join(' ')}`;
	}

	// 「次の仕事ある？」と聞き続ける。つながらなければ少し待って接続し直す
	async function loop() {
		while (!stopped) {
			try {
				if (!id) await connect();
				setStatus('connected');
				const job = await api<Job>(playerApi.next(id));
				if (!job) continue;
				log(describe(job));
				const reply = await handle(job);
				await api(playerApi.result(id), { method: 'POST', body: JSON.stringify(reply) });
			} catch (e) {
				if (stopped) break;
				if (e instanceof HttpError && e.status === 404) id = ''; // symphonix が再起動した
				setStatus('connecting');
				log(`接続できません（${e instanceof Error ? e.message : e}）。3 秒後にやり直します`);
				await wait(3000);
			}
		}
		id = '';
		setStatus('stopped');
	}

	return {
		// 動いている間は何度呼んでも 1 つだけ
		start: () => {
			if (!stopped && running) return running;
			stopped = false;
			abort = new AbortController();
			setStatus('connecting');
			running = loop();
			return running;
		},
		// 待ち中の通信も打ち切って止める。止まりきるまで待てる
		stop: async () => {
			stopped = true;
			abort.abort();
			await running;
		}
	};
}
