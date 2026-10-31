// 生成したプロジェクトの読み書き。ファイルは symphonix ではなくプレイヤーの作業フォルダにあり、
// すべてプレイヤーに頼んで行う。project は作業フォルダの中のフォルダ名
import path from 'node:path';
import { callPlayer } from './players.js';

export type GeneratedFile = { path: string; content: string };
export type Target = { player: string; project: string };
export type ProjectSummary = { name: string; files: number; updatedAt: string };

export function newProjectName(): string {
	return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

// フォルダ名やファイルパスがプロジェクトの外を指さないようにする（プレイヤー側でも作業フォルダの外は拒否する）
function inside(base: string, relative: string): string {
	const joined = path.posix.normalize(path.posix.join(base, relative.replace(/\\/g, '/')));
	if (joined === base || !joined.startsWith(base + '/') || path.posix.isAbsolute(relative)) {
		throw new Error(`プロジェクトの外には書き込めません: ${relative}`);
	}
	return joined;
}

export function checkProjectName(project: string): string {
	const name = project.trim();
	if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
		throw new Error(`フォルダ名が不正です: ${project}`);
	}
	return name;
}

export async function writeFiles(target: Target, files: GeneratedFile[]): Promise<string[]> {
	const project = checkProjectName(target.project);
	// 1 つでも不正なパスがあれば何も書かない
	const targets = files.map((file) => ({ full: inside(project, file.path), content: file.content }));
	for (const { full, content } of targets) {
		await callPlayer(target.player, 'write', { path: full, content });
	}
	return targets.map(({ full }) => path.posix.relative(project, full));
}

// プロジェクト内のファイルを、プロジェクトからの相対パスで返す（node_modules などはプレイヤーが除く）
export async function projectFiles(target: Target): Promise<string[]> {
	const project = checkProjectName(target.project);
	try {
		const { entries } = await callPlayer(target.player, 'list', { dir: project });
		return entries.filter((e) => e.type === 'file').map((e) => e.path);
	} catch (e) {
		// まだ何も書いていないプロジェクト
		if (e instanceof Error && /ENOENT/.test(e.message)) return [];
		throw e;
	}
}

async function readBytes(target: Target, rel: string): Promise<Buffer> {
	const { base64 } = await callPlayer(target.player, 'read', {
		path: inside(checkProjectName(target.project), rel)
	});
	return Buffer.from(base64, 'base64');
}

export async function readText(target: Target, rel: string): Promise<string> {
	return (await readBytes(target, rel)).toString('utf8');
}

export async function readProject(target: Target): Promise<GeneratedFile[]> {
	const files: GeneratedFile[] = [];
	for (const rel of await projectFiles(target)) {
		files.push({ path: rel, content: await readText(target, rel) });
	}
	return files;
}

// プレイヤーの作業フォルダにあるプロジェクト（直下のフォルダ）を新しい順に返す
export async function listProjects(player: string): Promise<ProjectSummary[]> {
	const { entries } = await callPlayer(player, 'list', { dir: '' });
	const projects = new Map<string, ProjectSummary>();
	for (const e of entries) {
		const [name, ...rest] = e.path.split('/');
		const p = projects.get(name) ?? { name, files: 0, updatedAt: new Date(0).toISOString() };
		if (rest.length && e.type === 'file') p.files++;
		if (e.type === 'dir' || rest.length) {
			const t = new Date(e.mtimeMs).toISOString();
			if (t > p.updatedAt) p.updatedAt = t;
			projects.set(name, p);
		}
	}
	return [...projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// ZIP にするため、プロジェクトのファイルをバイト列のまま読む
export async function readProjectBytes(target: Target): Promise<Record<string, Uint8Array>> {
	const files: Record<string, Uint8Array> = {};
	for (const rel of await projectFiles(target)) {
		files[rel] = await readBytes(target, rel);
	}
	return files;
}

// プロジェクトのフォルダでコマンドを実行する
export function runInProject(target: Target, command: string[], timeoutMs = 120_000) {
	return callPlayer(
		target.player,
		'run',
		{ cwd: checkProjectName(target.project), command, timeoutMs },
		timeoutMs + 15_000
	);
}
