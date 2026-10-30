import { chat } from './model.js';
import { readProject, writeFiles, type GeneratedFile } from './workspace.js';
import type { PlanStep } from '../plan.js';

const SYSTEM_PROMPT = `You are a software developer implementing a plan one step at a time.
You are given what the user wants to build, the whole plan, the files written so far, and the step to implement now.
Implement only the current step. Return the complete content of every file you create or change.
Respond with JSON only, in this exact shape:
{"files": [{"path": "relative/path/to/file", "content": "full file content"}]}`;

export async function implementStep(
	project: string,
	request: string,
	steps: PlanStep[],
	index: number
): Promise<GeneratedFile[]> {
	const existing = await readProject(project);
	const plan = steps.map((s, i) => `${i + 1}. ${s.title}: ${s.description}`).join('\n');
	const filesText = existing.length
		? existing.map((f) => `--- ${f.path}\n${f.content}`).join('\n')
		: '(no files yet)';
	const step = steps[index];
	const content = await chat([
		{ role: 'system', content: SYSTEM_PROMPT },
		{
			role: 'user',
			content: `What to build:\n${request}\n\nPlan:\n${plan}\n\nFiles so far:\n${filesText}\n\nCurrent step (${index + 1}): ${step.title}\n${step.description}`
		}
	]);
	const files = parseFiles(content);
	await writeFiles(project, files);
	return files;
}

// 最初の { から最後の } までを JSON として読む
export function parseFiles(content: string): GeneratedFile[] {
	const start = content.indexOf('{');
	const end = content.lastIndexOf('}');
	if (start === -1 || end <= start) {
		throw new Error(`ファイルを読み取れませんでした: ${content}`);
	}
	const data = JSON.parse(content.slice(start, end + 1));
	const files: unknown[] = Array.isArray(data.files) ? data.files : [];
	const result = files
		.filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
		.filter((f) => typeof f.path === 'string' && f.path && typeof f.content === 'string')
		.map((f) => ({ path: f.path as string, content: f.content as string }));
	if (result.length === 0) {
		throw new Error(`ファイルがありません: ${content}`);
	}
	return result;
}
