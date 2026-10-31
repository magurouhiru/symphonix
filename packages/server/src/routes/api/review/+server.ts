import { json } from '@sveltejs/kit';
import { reviewStep } from '#lib/server/review.js';
import { targetFrom } from '#lib/server/target.js';
import type { RequestHandler } from './$types';

// 実装したステップをレビュアー全員に確認してもらう。paths はそのステップで書いたファイル
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { request: want, steps, index, paths } = body;
	const target = targetFrom(body);
	if (
		typeof want !== 'string' ||
		!Array.isArray(steps) ||
		typeof index !== 'number' ||
		!steps[index] ||
		!target ||
		!Array.isArray(paths)
	) {
		return json({ error: 'request, steps, index, player, project and paths are required' }, { status: 400 });
	}
	try {
		return json({ reviews: await reviewStep(target, want, steps, index, paths) });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
	}
};
