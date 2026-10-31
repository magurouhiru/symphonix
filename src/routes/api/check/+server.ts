import { json } from '@sveltejs/kit';
import { checkProject } from '#lib/server/checks.js';
import { targetFrom } from '#lib/server/target.js';
import type { RequestHandler } from './$types';

// プロジェクトを自動チェックする（JSON や HTML の参照先、構文、npm install、build、test）
export const POST: RequestHandler = async ({ request }) => {
	const target = targetFrom(await request.json());
	if (!target) return json({ error: 'client and project are required' }, { status: 400 });
	try {
		return json({ checks: await checkProject(target) });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
	}
};
