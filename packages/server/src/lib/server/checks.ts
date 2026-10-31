// 実装したプロジェクトを自動でチェックする。ファイルの読み込みもコマンドの実行も、
// プロジェクトがあるプレイヤーに頼んで行う
import path from 'node:path';
import type { CheckResult } from '../checks.js';
import { projectFiles, readText, runInProject, type Target } from './workspace.js';

type RunResult = { code: number; output: string; timedOut: boolean };

// プレイヤーで許可していないコマンド（python3 など）や、入っていないコマンドは失敗ではなく飛ばす
async function run(target: Target, name: string, command: string[], timeoutMs: number): Promise<CheckResult> {
	let r: RunResult;
	try {
		r = await runInProject(target, command, timeoutMs);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		if (/許可していないコマンド/.test(message)) {
			return { name, ok: true, skipped: true, output: `${message}（プレイヤーの --allow で許可できます）` };
		}
		throw e;
	}
	if (r.code === -1 && /ENOENT/.test(r.output)) {
		return { name, ok: true, skipped: true, output: `プレイヤーにコマンドが無いので飛ばしました\n${r.output}`.trim() };
	}
	const output = r.timedOut ? `時間切れで止めました\n${r.output}` : r.output;
	return { name, ok: r.code === 0 && !r.timedOut, output: output.trim() };
}

// npm の既定の "Error: no test specified" はテストが無いのと同じ
const isPlaceholderTest = (script: string) => /no test specified/.test(script);

export async function checkProject(target: Target): Promise<CheckResult[]> {
	const files = await projectFiles(target);
	const read = (rel: string) => readText(target, rel);
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

	// JavaScript と Python の構文
	for (const rel of files.filter((f) => /\.(m?js|cjs)$/.test(f))) {
		results.push(await run(target, `${rel} の構文`, ['node', '--check', rel], 30_000));
	}
	const python = files.filter((f) => f.endsWith('.py'));
	if (python.length) {
		results.push(await run(target, 'Python の構文', ['python3', '-m', 'py_compile', ...python], 30_000));
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
			const install = await run(
				target,
				'npm install',
				['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund'],
				300_000
			);
			results.push(install);
			if (!install.ok || install.skipped) return results;
		}
		if (pkg.scripts?.build) {
			results.push(await run(target, 'npm run build', ['npm', 'run', 'build'], 300_000));
		}
		if (pkg.scripts?.test && !isPlaceholderTest(pkg.scripts.test)) {
			results.push(await run(target, 'npm test', ['npm', 'test'], 300_000));
		}
	}
	return results;
}
