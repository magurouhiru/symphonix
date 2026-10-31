import { json } from '@sveltejs/kit';
import { setReviewers } from '#lib/personas/store.server.js';
import type { RequestHandler } from './$types';

// { reviewers: [ペルソナの id, ...] } でレビュアーを決める。空ならレビューしない
export const PUT: RequestHandler = async ({ request }) => {
	const { reviewers } = await request.json();
	if (!Array.isArray(reviewers) || !reviewers.every((id) => typeof id === 'string')) {
		return json({ error: 'reviewers must be a list of persona ids' }, { status: 400 });
	}
	setReviewers(reviewers);
	return json({ ok: true });
};
