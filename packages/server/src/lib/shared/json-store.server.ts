// 画面から変えた設定などを JSON ファイルに保存する。読み込みは初回だけで、あとはメモリの値を使う
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function jsonStore<T>(file: string, options: { initial: () => T; migrate?: (data: T) => T }) {
	const fullPath = path.resolve(file);
	let cache: T | null = null;
	return {
		get(): T {
			if (cache === null) {
				try {
					const data = JSON.parse(readFileSync(fullPath, 'utf8')) as T;
					cache = options.migrate ? options.migrate(data) : data;
				} catch {
					cache = options.initial();
				}
			}
			return cache;
		},
		set(value: T) {
			cache = value;
			mkdirSync(path.dirname(fullPath), { recursive: true });
			writeFileSync(fullPath, JSON.stringify(value, null, '\t') + '\n');
		}
	};
}
