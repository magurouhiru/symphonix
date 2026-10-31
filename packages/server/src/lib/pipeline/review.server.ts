// 実装したステップを、割り当てたレビュアーが 1 人ずつ確認する
import { chat } from '#lib/ai/chat.server.js';
import { reviewers, withPersona } from '#lib/personas/store.server.js';
import { readProject, type Target } from '#lib/players/workspace.server.js';
import type { PlanStep, Review } from './types.js';

const SYSTEM_PROMPT = `You are reviewing one step of a plan that another developer just implemented.
You are given what the user wants to build, the whole plan, the current step, and the files the developer wrote in this step.
Judge only the current step; later steps will be implemented afterwards, so do not ask for them.
Each file is shown with a line number before every line ("12| "); the numbers are not part of the file.
Request changes only for real problems that would make this step not work or not do what it asks.
Do not request changes for style, naming, comments, or optional improvements.
For every problem, cite the file and line number and quote the line as it is now, then say what to change.
If you cannot point to a specific line that is wrong, or you are not sure, APPROVE.
The first line of your answer must be exactly APPROVE or REQUEST_CHANGES.
After that, briefly explain why.
Write the explanation in the same language as the user's request.`;

export async function reviewStep(
	target: Target,
	request: string,
	steps: PlanStep[],
	index: number,
	paths: string[]
): Promise<Review[]> {
	const files = await readProject(target, paths);
	const plan = steps.map((s, i) => `${i + 1}. ${s.title}: ${s.description}`).join('\n');
	const filesText = files.map((f) => `=== FILE: ${f.path} ===\n${numbered(f.content)}\n=== END FILE ===`).join('\n');
	const step = steps[index];
	const user = `What to build:\n${request}\n\nPlan:\n${plan}\n\nCurrent step (${index + 1}): ${step.title}\n${step.description}\n\nFiles written in this step:\n${filesText}`;
	// VRAM に 1 つしかモデルを載せられないので、並列にせず順番に聞く
	const results: Review[] = [];
	for (const persona of reviewers()) {
		const answer = await chat(
			[
				{ role: 'system', content: withPersona(persona.prompt, SYSTEM_PROMPT) },
				{ role: 'user', content: user }
			],
			persona.resolvedModel
		);
		results.push({
			persona: persona.id,
			name: persona.name,
			model: persona.resolvedModel,
			...parseReview(answer)
		});
	}
	return results;
}

// 小さいモデルは閉じタグの有無などを見間違えやすいので、行番号を付けてどの行かを示させる
function numbered(content: string): string {
	return content
		.replace(/\n$/, '')
		.split('\n')
		.map((line, i) => `${i + 1}| ${line}`)
		.join('\n');
}

// 1 行目の判定を読む。どちらとも読めないときは承認しない
export function parseReview(answer: string): { approved: boolean; comment: string } {
	const text = answer.trim().replace(/^[*#`\s]+/, '');
	const approved = /^APPROVE\b/i.test(text);
	const comment = text.replace(/^(APPROVE|REQUEST_CHANGES)\b[*`:\s]*/i, '').trim();
	return { approved, comment: comment || (approved ? '問題ありません' : answer.trim()) };
}
