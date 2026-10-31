// 実装したプロジェクトを自動でチェックする。ファイルを読むだけで済むものは symphonix で、
// コードを動かすもの（npm install、ビルド、テスト、構文チェック）は runner コンテナで実行する
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CheckResult } from '../checks.js';
import { projectDir, projectFiles } from './workspace.js';

const runnerUrl = process.env.RUNNER_URL ?? 'http://runner:7070';

type RunResult = { code: number; output: string; timedOut: boolean };

async function runInRunner(project: string, command: string[], timeoutMs = 120_000): Promise<RunResult> {
	const res = await fetch(`${runnerUrl}/run`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ project, command, timeoutMs }),
		signal: AbortSignal.timeout(timeoutMs + 10_000)
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error);
	return data;
}

async function runnerAvailable(): Promise<boolean> {
	try {
		return (await fetch(`${runnerUrl}/health`, { signal: AbortSignal.timeout(2000) })).ok;
	} catch {
		return false;
	}
}

function fromRun(name: string, r: RunResult): CheckResult {
	// runner にそのコマンドが入っていない（python3 など）ときは失敗ではなく飛ばす
	if (r.code === -1 && /ENOENT/.test(r.output)) {
		return { name, ok: true, skipped: true, output: `runner にコマンドが無いので飛ばしました\n${r.output}`.trim() };
	}
	const output = r.timedOut ? `時間切れで止めました\n${r.output}` : r.output;
	return { name, ok: r.code === 0 && !r.timedOut, output: output.trim() };
}

// npm の既定の "Error: no test specified" はテストが無いのと同じ
const isPlaceholderTest = (script: string) => /no test specified/.test(script);

export async function checkProject(project: string): Promise<CheckResult[]> {
	const dir = projectDir(project);
	const files = await projectFiles(dir);
	const read = (rel: string) => readFile(path.join(dir, rel), 'utf8');
	const results: CheckResult[] = [];

	// JSON が壊れていないか
	for (const rel of files.filter((f) => f.endsWith('.json'))) {
		try {
			JSON.parse(await read(rel));
		} catch (e) {
			results.push({ name: `${rel} の JSON`, ok: false, output: String(e) });
		}
	}

	// HTML から読み込んでいるローカルのファイルが実際にあるか
	for (const rel of files.filter((f) => f.endsWith('.html'))) {
		const html = await read(rel);
		const missing = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"'#?]+)/gi)]
			.map((m) => m[1])
			.filter((ref) => !/^([a-z]+:|\/\/|data:)/i.test(ref))
			.map((ref) => ({ ref, target: path.posix.normalize(path.posix.join(path.posix.dirname(rel), ref.replace(/^\//, ''))) }))
			.filter(({ target }) => !files.includes(target) && !files.includes(path.posix.join(target, 'index.html')));
		if (missing.length) {
			results.push({
				name: `${rel} の参照先`,
				ok: false,
				output: missing.map(({ ref }) => `${ref} が見つかりません`).join('\n')
			});
		}
	}

	if (!(await runnerAvailable())) {
		results.push({
			name: 'ビルド・テスト',
			ok: true,
			skipped: true,
			output: `runner（${runnerUrl}）につながらないので、コードを動かすチェックは飛ばしました`
		});
		return results;
	}

	// JavaScript と Python の構文
	for (const rel of files.filter((f) => /\.(m?js|cjs)$/.test(f))) {
		results.push(fromRun(`${rel} の構文`, await runInRunner(project, ['node', '--check', rel], 30_000)));
	}
	const python = files.filter((f) => f.endsWith('.py'));
	if (python.length) {
		results.push(fromRun('Python の構文', await runInRunner(project, ['python3', '-m', 'py_compile', ...python], 30_000)));
	}

	// package.json があれば依存を入れて、build と test を実行する
	if (files.includes('package.json')) {
		let pkg: { dependencies?: object; devDependencies?: object; scripts?: Record<string, string> } = {};
		try {
			pkg = JSON.parse(await read('package.json'));
		} catch {
			return results; // 壊れていることは上で報告済み
		}
		const hasDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length > 0;
		if (hasDeps) {
			// install スクリプトは実行しない
			const install = await runInRunner(
				project,
				['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund'],
				300_000
			);
			results.push(fromRun('npm install', install));
			if (install.code !== 0) return results;
		}
		if (pkg.scripts?.build) {
			results.push(fromRun('npm run build', await runInRunner(project, ['npm', 'run', 'build'], 300_000)));
		}
		if (pkg.scripts?.test && !isPlaceholderTest(pkg.scripts.test)) {
			results.push(fromRun('npm test', await runInRunner(project, ['npm', 'test'], 300_000)));
		}
	}
	return results;
}
