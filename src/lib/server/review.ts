// 実装したステップを、割り当てたレビュアーが 1 人ずつ確認する
import { chat } from './model.js';
import { reviewers, withPersona } from './personas.js';
import { readProject } from './workspace.js';
import type { Review } from '../personas.js';
import type { PlanStep } from '../plan.js';

const SYSTEM_PROMPT = `You are reviewing one step of a plan that another developer just implemented.
You are given what the user wants to build, the whole plan, the current step, and the files the developer wrote in this step.
Judge only the current step; later steps will be implemented afterwards, so do not ask for them.
The first line of your answer must be exactly APPROVE or REQUEST_CHANGES.
After that, briefly explain why. If you request changes, list concretely what to fix.
Write the explanation in the same language as the user's request.`;

export async function reviewStep(
	project: string,
	request: string,
	steps: PlanStep[],
	index: number,
	paths: string[]
): Promise<Review[]> {
	const files = (await readProject(project)).filter((f) => paths.includes(f.path));
	const plan = steps.map((s, i) => `${i + 1}. ${s.title}: ${s.description}`).join('\n');
	const filesText = files.map((f) => `=== FILE: ${f.path} ===\n${f.content}\n=== END FILE ===`).join('\n');
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

// 1 行目の判定を読む。どちらとも読めないときは承認しない
export function parseReview(answer: string): { approved: boolean; comment: string } {
	const text = answer.trim().replace(/^[*#`\s]+/, '');
	const approved = /^APPROVE\b/i.test(text);
	const comment = text.replace(/^(APPROVE|REQUEST_CHANGES)\b[*`:\s]*/i, '').trim();
	return { approved, comment: comment || (approved ? '問題ありません' : answer.trim()) };
}
