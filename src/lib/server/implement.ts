import { chat } from './model.js';
import { personaFor, withPersona } from './personas.js';
import { readProject, writeFiles, type GeneratedFile } from './workspace.js';
import type { PlanStep } from '../plan.js';

// コードを JSON に入れると引用符や改行のエスケープを間違えやすいので、ファイルは区切り行で囲んで返させる
const SYSTEM_PROMPT = `You are a software developer implementing a plan one step at a time.
You are given what the user wants to build, the whole plan, the files written so far, and the step to implement now.
Implement only the current step. Return the complete content of every file you create or change.
Write each file exactly like this, with nothing between the marker lines but the raw file content (no code fences, no escaping):
=== FILE: relative/path/to/file ===
full file content
=== END FILE ===
Do not write anything outside these blocks.`;

// 読み取れない返事が来たら、もう一度だけ頼み直す
const ATTEMPTS = 2;

export async function implementStep(
	project: string,
	request: string,
	steps: PlanStep[],
	index: number
): Promise<GeneratedFile[]> {
	const existing = await readProject(project);
	const plan = steps.map((s, i) => `${i + 1}. ${s.title}: ${s.description}`).join('\n');
	const filesText = existing.length
		? existing.map((f) => `=== FILE: ${f.path} ===\n${f.content}\n=== END FILE ===`).join('\n')
		: '(no files yet)';
	const step = steps[index];
	const persona = personaFor('code');
	const messages = [
		{ role: 'system' as const, content: withPersona(persona.prompt, SYSTEM_PROMPT) },
		{
			role: 'user' as const,
			content: `What to build:\n${request}\n\nPlan:\n${plan}\n\nFiles so far:\n${filesText}\n\nCurrent step (${index + 1}): ${step.title}\n${step.description}`
		}
	];
	let lastError: unknown;
	for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
		const content = await chat(messages, persona.resolvedModel);
		try {
			const files = parseFiles(content);
			await writeFiles(project, files);
			return files;
		} catch (e) {
			lastError = e;
		}
	}
	throw lastError;
}

// === FILE: パス === から === END FILE === までを 1 ファイルとして読む
export function parseFiles(content: string): GeneratedFile[] {
	const result: GeneratedFile[] = [];
	const pattern = /^=== FILE: (.+?) ===\r?\n([\s\S]*?)^=== END FILE ===/gm;
	for (const match of content.matchAll(pattern)) {
		const path = match[1].trim();
		if (path) result.push({ path, content: unfence(match[2]) });
	}
	if (result.length === 0) {
		throw new Error(`ファイルを読み取れませんでした: ${content.slice(0, 2000)}`);
	}
	return result;
}

// 指示に反してコードフェンスで囲んできたら外す
function unfence(text: string): string {
	const fenced = text.match(/^```[^\n]*\n([\s\S]*?)\n?```\s*$/);
	return fenced ? fenced[1] + '\n' : text;
}
