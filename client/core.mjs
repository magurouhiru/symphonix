// symphonix のクライアント本体。symphonix に接続し、頼まれたファイル操作やコマンド実行を
// 指定したフォルダ（root）の中だけで行う。VS Code 拡張からもそのまま使えるよう、Node の標準機能だけで書く
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

// 一覧に出さないフォルダ（npm install やビルドで増えるもの）
const IGNORED = new Set(['node_modules', '.git', 'dist']);
// コマンドの出力は末尾だけ返す（エラーは最後に出ることが多いため）
const MAX_OUTPUT = 8000;
const DEFAULT_ALLOW = ['node', 'npm', 'python3'];

/**
 * @param {object} options
 * @param {string} options.server symphonix の URL（例: http://localhost:5173）
 * @param {string} options.root 作業フォルダ。この外は読み書きしない
 * @param {string} [options.name] symphonix の画面に出す名前
 * @param {string[]} [options.allow] 実行してよいコマンド
 * @param {(message: string) => void} [options.log]
 */
export function createClient({ server, root, name, allow = DEFAULT_ALLOW, log = console.log }) {
	const base = server.replace(/\/$/, '');
	const rootDir = path.resolve(root);
	let stopped = false;
	let id = '';

	// root の外を指すパスは拒否する
	function resolveInside(relative) {
		const full = path.resolve(rootDir, relative ?? '');
		if (full !== rootDir && !full.startsWith(rootDir + path.sep)) {
			throw new Error(`作業フォルダの外は扱えません: ${relative}`);
		}
		return full;
	}

	const handlers = {
		// dir の中のファイルとフォルダを返す。depth を省くとすべての階層
		async list({ dir = '', depth = Infinity }) {
			const start = resolveInside(dir);
			const entries = [];
			async function walk(current, level) {
				for (const entry of await readdir(current, { withFileTypes: true }).catch(() => [])) {
					if (IGNORED.has(entry.name)) continue;
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
		// バイナリでも壊れないよう base64 で返す
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
			return new Promise((resolve) => {
				const child = spawn(command[0], command.slice(1), {
					cwd: dir,
					env: { ...process.env, CI: '1', NO_COLOR: '1' },
					detached: process.platform !== 'win32',
					shell: process.platform === 'win32' // Windows では npm が npm.cmd のため
				});
				let output = '';
				const append = (chunk) => (output = (output + chunk).slice(-MAX_OUTPUT));
				child.stdout.on('data', append);
				child.stderr.on('data', append);
				let timedOut = false;
				const timer = setTimeout(() => {
					timedOut = true;
					try {
						if (process.platform === 'win32') child.kill();
						else process.kill(-child.pid, 'SIGKILL');
					} catch {}
				}, timeoutMs);
				const finish = (code) => {
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

	async function api(pathname, init) {
		const res = await fetch(`${base}${pathname}`, {
			...init,
			headers: { 'Content-Type': 'application/json' }
		});
		if (res.status === 204) return null;
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			const error = new Error(data.error ?? `HTTP ${res.status}`);
			error.status = res.status;
			throw error;
		}
		return data;
	}

	async function connect() {
		const data = await api('/api/clients/connect', {
			method: 'POST',
			body: JSON.stringify({ name: name ?? path.basename(rootDir), root: rootDir, allow })
		});
		id = data.id;
		log(`symphonix（${base}）に接続しました: ${rootDir}`);
	}

	async function handle(job) {
		try {
			const handler = handlers[job.method];
			if (!handler) throw new Error(`知らない仕事です: ${job.method}`);
			return { jobId: job.id, result: await handler(job.params ?? {}) };
		} catch (e) {
			return { jobId: job.id, error: e instanceof Error ? e.message : String(e) };
		}
	}

	// 「次の仕事ある？」と聞き続ける。つながらなければ少し待って接続し直す
	async function loop() {
		while (!stopped) {
			try {
				if (!id) await connect();
				const job = await api(`/api/clients/${id}/next`);
				if (!job) continue;
				log(`${job.method} ${job.params?.path ?? job.params?.dir ?? (job.params?.command ?? []).join(' ')}`);
				const reply = await handle(job);
				await api(`/api/clients/${id}/result`, { method: 'POST', body: JSON.stringify(reply) });
			} catch (e) {
				if (e.status === 404) id = ''; // symphonix が再起動した
				if (stopped) break;
				log(`接続できません（${e.message}）。3 秒後にやり直します`);
				await new Promise((r) => setTimeout(r, 3000));
			}
		}
	}

	return {
		start() {
			stopped = false;
			return loop();
		},
		stop() {
			stopped = true;
		},
		handlers
	};
}
