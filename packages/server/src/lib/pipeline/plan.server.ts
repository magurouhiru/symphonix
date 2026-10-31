import { chat } from '#lib/ai/chat.server.js';
import { translatorFor } from '#lib/ai/translate.server.js';
import { personaFor, withPersona } from '#lib/personas/store.server.js';
import type { Target } from '#lib/players/workspace.server.js';
import { contextText, projectContext } from './context.server.js';
import type { PlanStep } from './types.js';

const SYSTEM_PROMPT = `You are a software planner. The user describes something they want to build.
Break it into 3 to 5 small implementation steps, in the order they should be built.
Respond with JSON only, in this exact shape:
{"steps": [{"title": "short title", "description": "what to implement in this step"}]}
Write titles and descriptions in the same language as the user.`;

const EXISTING_PROMPT = `
The user wants to change an existing project, whose files are shown after the request.
Plan only the changes; do not plan to rebuild what already exists. Name the files each step changes or adds.`;

// target を渡すと、そのフォルダにある既存のプロジェクトを変える前提でプランを作る
export async function createPlan(request: string, target?: Target): Promise<PlanStep[]> {
	const persona = personaFor('plan');
	// 日本語が苦手なモデルには英語で頼み、返ってきたプランを日本語に戻す
	const t = translatorFor(persona);
	const want = await t.toModel(request);
	const context = target ? await projectContext(target, want, persona.resolvedModel) : null;
	const existing = context && context.paths.length > 0;
	const messages = [
		{ role: 'system' as const, content: withPersona(persona.prompt, SYSTEM_PROMPT + (existing ? EXISTING_PROMPT : '')) },
		{ role: 'user' as const, content: existing ? `${want}\n\nExisting project:\n${contextText(context)}` : want }
	];
	// 読み取れない返事が来たら、もう一度だけ頼み直す
	let steps: PlanStep[];
	try {
		steps = parsePlan(await chat(messages, persona.resolvedModel));
	} catch {
		steps = parsePlan(await chat(messages, persona.resolvedModel));
	}
	return t.steps(steps, 'ja');
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
