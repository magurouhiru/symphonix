// 実行の記録を data/runs/<id>.json に 1 件 1 ファイルで残す。
// 読み込みは初回だけで、あとはメモリの値を書き換えるたびにファイルへ書き出す
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { RunRecord, RunSummary } from './types.js';

const dir = path.resolve(process.env.RUNS_PATH ?? 'data/runs');

// 開発サーバーでモジュールが読み直されても、実行中の記録を同じものとして扱うよう globalThis に置く
const store = globalThis as typeof globalThis & { __symphonixRuns?: Map<string, RunRecord> };

function runs(): Map<string, RunRecord> {
	if (store.__symphonixRuns) return store.__symphonixRuns;
	const map = new Map<string, RunRecord>();
	let names: string[] = [];
	try {
		names = readdirSync(dir).filter((n) => n.endsWith('.json'));
	} catch {
		// まだ 1 件も無い
	}
	for (const name of names) {
		try {
			const run = JSON.parse(readFileSync(path.join(dir, name), 'utf8')) as RunRecord;
			// 読み込んだ時点で running のものは、前のプロセスが途中で終わったもの
			if (run.state === 'running') {
				run.state = 'interrupted';
				for (const r of run.results) {
					if (r.status !== 'pending' && r.status !== 'done') r.status = 'interrupted';
				}
				write(run);
			}
			map.set(run.id, run);
		} catch {
			// 壊れたファイルは飛ばす
		}
	}
	return (store.__symphonixRuns = map);
}

// 書きかけのファイルを読まないよう、別名に書いてから置き換える
function write(run: RunRecord) {
	mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `${run.id}.json`);
	writeFileSync(`${file}.tmp`, JSON.stringify(run, null, '\t') + '\n');
	renameSync(`${file}.tmp`, file);
}

export function newRunId(): string {
	const time = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
	return `${time}-${randomBytes(2).toString('hex')}`;
}

export function getRun(id: string): RunRecord | undefined {
	return runs().get(id);
}

// 中身を書き換えたら必ず呼ぶ
export function saveRun(run: RunRecord) {
	run.updatedAt = new Date().toISOString();
	runs().set(run.id, run);
	write(run);
}

export function listRuns(): RunSummary[] {
	return [...runs().values()]
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
		.map((r) => ({
			id: r.id,
			createdAt: r.createdAt,
			updatedAt: r.updatedAt,
			state: r.state,
			request: r.request,
			project: r.project,
			steps: r.steps.length,
			done: r.results.filter((x) => x.status === 'done').length
		}));
}
