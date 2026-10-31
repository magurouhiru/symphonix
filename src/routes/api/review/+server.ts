import { json } from '@sveltejs/kit';
import { reviewStep } from '#lib/server/review.js';
import type { RequestHandler } from './$types';

// 実装したステップをレビュアー全員に確認してもらう。paths はそのステップで書いたファイル
export const POST: RequestHandler = async ({ request }) => {
	const { request: want, steps, index, project, paths } = await request.json();
	if (
		typeof want !== 'string' ||
		!Array.isArray(steps) ||
		typeof index !== 'number' ||
		!steps[index] ||
		typeof project !== 'string' ||
		!project ||
		!Array.isArray(paths)
	) {
		return json({ error: 'request, steps, index, project and paths are required' }, { status: 400 });
	}
	try {
		return json({ reviews: await reviewStep(project, want, steps, index, paths) });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
	}
};
