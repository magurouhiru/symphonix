// モデルに渡すプロジェクトの中身を選ぶ。小さいプロジェクトは全部渡し、
// 大きいものはパスの一覧を見せて、作業に関係しそうなファイルだけをモデルに選ばせる
import { chat } from '#lib/ai/chat.server.js';
import { projectEntries, readProject, type GeneratedFile, type Target } from '#lib/players/workspace.server.js';

// 中身を渡すファイルの合計サイズ（バイト）の上限。小さいモデルのコンテキストに収まるくらい
export const CONTEXT_BUDGET = 40_000;
// 1 ファイルがこれより大きければ中身は渡さない
const MAX_FILE_SIZE = 20_000;
// 中身を読んでも役に立たないファイル
const SKIP = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|eot|mp3|wav|mp4|zip|gz|pdf|wasm)$/i;

export type ProjectContext = {
	// プロジェクトにあるすべてのファイル
	paths: string[];
	// 中身を渡すファイル
	files: GeneratedFile[];
	// 一部のファイルしか中身を渡していないか
	partial: boolean;
};

// task はこれからする作業の説明。include は必ず中身を渡すファイル（このステップで書いたものなど）
export async function projectContext(
	target: Target,
	task: string,
	model: string,
	include: string[] = []
): Promise<ProjectContext> {
	const entries = await projectEntries(target);
	const paths = entries.map((e) => e.path);
	const readable = entries.filter((e) => !SKIP.test(e.path) && e.size <= MAX_FILE_SIZE);
	const total = readable.reduce((sum, e) => sum + e.size, 0);
	if (total <= CONTEXT_BUDGET) {
		return { paths, files: await readProject(target, readable.map((e) => e.path)), partial: readable.length < paths.length };
	}
	const picked = await pickFiles(task, readable, model);
	// 必ず渡すもの、モデルが選んだものの順に、上限まで入れる
	const sizes = new Map(readable.map((e) => [e.path, e.size]));
	const chosen: string[] = [];
	let used = 0;
	for (const p of [...include, ...picked]) {
		const size = sizes.get(p);
		if (size === undefined || chosen.includes(p) || used + size > CONTEXT_BUDGET) continue;
		chosen.push(p);
		used += size;
	}
	return { paths, files: await readProject(target, chosen), partial: true };
}

const PICK_PROMPT = `You are helping a developer work on an existing project.
You are given the task and the list of files in the project with their sizes in bytes.
Choose the files whose content the developer must read to do the task: files to change, and files they depend on or that show how the project is structured (such as package.json or the entry point).
Respond with JSON only, in this exact shape, most important first:
{"files": ["path/one", "path/two"]}`;

async function pickFiles(task: string, entries: { path: string; size: number }[], model: string): Promise<string[]> {
	const list = entries.map((e) => `${e.path} (${e.size})`).join('\n');
	const messages = [
		{ role: 'system' as const, content: PICK_PROMPT },
		{ role: 'user' as const, content: `Task:\n${task}\n\nFiles:\n${list}` }
	];
	// 読み取れなければもう一度だけ頼み、それでも駄目なら何も選ばない
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			return parsePicked(await chat(messages, model), new Set(entries.map((e) => e.path)));
		} catch {}
	}
	return [];
}

export function parsePicked(content: string, known: Set<string>): string[] {
	const start = content.indexOf('{');
	const end = content.lastIndexOf('}');
	if (start === -1 || end <= start) throw new Error('JSON がありません');
	const data = JSON.parse(content.slice(start, end + 1));
	if (!Array.isArray(data.files)) throw new Error('files がありません');
	return data.files.map((f: unknown) => String(f).replace(/^\.\//, '')).filter((f: string) => known.has(f));
}

// プロンプトに入れる形にする
export function contextText(context: ProjectContext): string {
	if (context.paths.length === 0) return '(no files yet)';
	const contents = context.files.map((f) => `=== FILE: ${f.path} ===\n${f.content}\n=== END FILE ===`).join('\n');
	if (!context.partial) return contents;
	return `All files in the project:\n${context.paths.join('\n')}\n\nContents of the files relevant to this task (other files exist but are not shown; do not rewrite a file you have not seen):\n${contents || '(none)'}`;
}
