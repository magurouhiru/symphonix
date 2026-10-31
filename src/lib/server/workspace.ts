import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
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
	const dir = resolveInside(root, project);
	if (dir === root) throw new Error(`プロジェクト名が不正です: ${project}`);
	return dir;
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

// 自動チェックで npm install やビルドをすると増えるフォルダ。モデルに見せたり ZIP に入れたりしない
const IGNORED = new Set(['node_modules', '.git', 'dist']);

// プロジェクト内のファイルを、プロジェクトからの相対パス（/ 区切り）で返す
export async function projectFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []);
	return entries
		.filter((entry) => entry.isFile())
		.map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
		.filter((rel) => !rel.split('/').some((part) => IGNORED.has(part)));
}

export async function readProject(project: string): Promise<GeneratedFile[]> {
	const dir = projectDir(project);
	const files: GeneratedFile[] = [];
	for (const rel of await projectFiles(dir)) {
		files.push({ path: rel, content: await readFile(path.join(dir, rel), 'utf8') });
	}
	return files;
}

export type ProjectSummary = { name: string; files: number; updatedAt: string };

// 作業フォルダにあるプロジェクトを新しい順に返す
export async function listProjects(): Promise<ProjectSummary[]> {
	const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
	const projects: ProjectSummary[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const dir = path.join(root, entry.name);
		const files = await projectFiles(dir);
		const times = await Promise.all(files.map((rel) => stat(path.join(dir, rel))));
		const updated = Math.max((await stat(dir)).mtimeMs, ...times.map((t) => t.mtimeMs));
		projects.push({ name: entry.name, files: files.length, updatedAt: new Date(updated).toISOString() });
	}
	return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// ZIP にするため、プロジェクトのファイルをバイト列のまま読む
export async function readProjectBytes(project: string): Promise<Record<string, Uint8Array>> {
	const dir = projectDir(project);
	await stat(dir);
	const files: Record<string, Uint8Array> = {};
	for (const rel of await projectFiles(dir)) {
		files[rel] = await readFile(path.join(dir, rel));
	}
	return files;
}
