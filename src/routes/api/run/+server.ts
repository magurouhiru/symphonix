import { json } from '@sveltejs/kit';
import { implementStep } from '#lib/server/implement.js';
import { newProjectName, projectDir } from '#lib/server/workspace.js';
import type { RequestHandler } from './$types';

// プランの 1 ステップを実装して作業フォルダに書き出す。project が無ければ新しく作る
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { request: want, steps, index } = body;
	if (typeof want !== 'string' || !Array.isArray(steps) || typeof index !== 'number' || !steps[index]) {
		return json({ error: 'request, steps and index are required' }, { status: 400 });
	}
	const project = typeof body.project === 'string' && body.project ? body.project : newProjectName();
	try {
		const files = await implementStep(project, want, steps, index);
		return json({ project, dir: projectDir(project), files });
	} catch (e) {
		return json({ project, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
	}
};
