// 生成したコードのビルドやテストを、symphonix 本体とは別のコンテナで実行する小さなサーバー。
// /workspace（symphonix の workspace/）だけが見えるので、生成したコードが本体のソースや .git を壊すことはない
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import path from 'node:path';

const root = path.resolve(process.env.WORKSPACE_DIR ?? '/workspace');
const port = Number(process.env.PORT ?? 7070);
// 出力は末尾だけ返す（エラーは最後に出ることが多いため）
const MAX_OUTPUT = 8000;

function run({ project, command, timeoutMs = 120_000 }) {
	const cwd = path.resolve(root, String(project));
	if (!cwd.startsWith(root + path.sep)) throw new Error(`作業フォルダの外では実行できません: ${project}`);
	if (!Array.isArray(command) || command.length === 0 || !command.every((c) => typeof c === 'string')) {
		throw new Error('command must be a list of strings');
	}
	return new Promise((resolve) => {
		const started = Date.now();
		// シェルを通さず、決まったコマンドだけを引数つきで実行する
		const child = spawn(command[0], command.slice(1), {
			cwd,
			env: { ...process.env, CI: '1', NO_COLOR: '1' },
			detached: true
		});
		let output = '';
		const append = (chunk) => {
			output = (output + chunk).slice(-MAX_OUTPUT);
		};
		child.stdout.on('data', append);
		child.stderr.on('data', append);
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			// 子プロセスごと止める
			try {
				process.kill(-child.pid, 'SIGKILL');
			} catch {}
		}, timeoutMs);
		const finish = (code) => {
			clearTimeout(timer);
			resolve({ code, output, timedOut, ms: Date.now() - started });
		};
		child.on('error', (e) => {
			append(String(e));
			finish(-1);
		});
		child.on('close', (code) => finish(code ?? -1));
	});
}

createServer((req, res) => {
	const send = (status, body) => {
		res.writeHead(status, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify(body));
	};
	if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
	if (req.method !== 'POST' || req.url !== '/run') return send(404, { error: 'not found' });
	let body = '';
	req.on('data', (c) => (body += c));
	req.on('end', async () => {
		try {
			send(200, await run(JSON.parse(body)));
		} catch (e) {
			send(400, { error: e instanceof Error ? e.message : String(e) });
		}
	});
}).listen(port, () => console.log(`runner listening on ${port}, workspace ${root}`));
