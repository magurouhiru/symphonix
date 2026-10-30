import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.env.WORKSPACE_DIR ?? 'workspace');

export type GeneratedFile = { path: string; content: string };

export function newProjectName(): string {
	return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

// プロジェクト名やファイルパスが作業フォルダの外を指さないようにする
function resolveInside(base: string, relative: string): string {
	const full = path.resolve(base, relative);
	if (full !== base && !full.startsWith(base + path.sep)) {
		throw new Error(`作業フォルダの外には書き込めません: ${relative}`);
	}
	return full;
}

export function projectDir(project: string): string {
	return resolveInside(root, project);
}

export async function writeFiles(project: string, files: GeneratedFile[]): Promise<string[]> {
	const dir = projectDir(project);
	// 1 つでも不正なパスがあれば何も書かない
	const targets = files.map((file) => ({ full: resolveInside(dir, file.path), content: file.content }));
	const written: string[] = [];
	for (const { full, content } of targets) {
		await mkdir(path.dirname(full), { recursive: true });
		await writeFile(full, content);
		written.push(path.relative(dir, full));
	}
	return written;
}

export async function readProject(project: string): Promise<GeneratedFile[]> {
	const dir = projectDir(project);
	const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []);
	const files: GeneratedFile[] = [];
	for (const entry of entries) {
		if (!entry.isFile()) continue;
		const full = path.join(entry.parentPath, entry.name);
		files.push({ path: path.relative(dir, full), content: await readFile(full, 'utf8') });
	}
	return files;
}
