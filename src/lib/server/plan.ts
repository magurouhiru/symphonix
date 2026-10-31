import { chat } from './model.js';
import { personaFor, withPersona } from './personas.js';
import type { PlanStep } from '../plan.js';

const SYSTEM_PROMPT = `You are a software planner. The user describes something they want to build.
Break it into 3 to 5 small implementation steps, in the order they should be built.
Respond with JSON only, in this exact shape:
{"steps": [{"title": "short title", "description": "what to implement in this step"}]}
Write titles and descriptions in the same language as the user.`;

export async function createPlan(request: string): Promise<PlanStep[]> {
	const persona = personaFor('plan');
	const content = await chat(
		[
			{ role: 'system', content: withPersona(persona.prompt, SYSTEM_PROMPT) },
			{ role: 'user', content: request }
		],
		persona.resolvedModel
	);
	return parsePlan(content);
}

// 小さいモデルは JSON の前後に文章やコードフェンスを付けがちなので、最初の { から最後の } までを読む
export function parsePlan(content: string): PlanStep[] {
	const start = content.indexOf('{');
	const end = content.lastIndexOf('}');
	if (start === -1 || end <= start) {
		throw new Error(`プランを読み取れませんでした: ${content}`);
	}
	const data = JSON.parse(content.slice(start, end + 1));
	const steps: unknown[] = Array.isArray(data.steps) ? data.steps : [];
	const result = steps
		.filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
		.map((s) => ({ title: String(s.title ?? ''), description: String(s.description ?? '') }))
		.filter((s) => s.title);
	if (result.length === 0) {
		throw new Error(`プランにステップがありません: ${content}`);
	}
	return result;
}
