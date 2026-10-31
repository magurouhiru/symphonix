import { json } from '@sveltejs/kit';
import { checkProject } from '#lib/server/checks.js';
import type { RequestHandler } from './$types';

// プロジェクトを自動チェックする（JSON や HTML の参照先、構文、npm install、build、test）
export const POST: RequestHandler = async ({ request }) => {
	const { project } = await request.json();
	if (typeof project !== 'string' || !project) {
		return json({ error: 'project is required' }, { status: 400 });
	}
	try {
		return json({ checks: await checkProject(project) });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
	}
};
