import { setReviewers } from '#lib/personas/store.server.js';
import type { RequestHandler } from './$types';

// { reviewers: [ペルソナの id, ...] } でレビュアーを決める。空ならレビューしない
export const PUT: RequestHandler = async ({ request }) => {
	const { reviewers } = await request.json();
	if (!Array.isArray(reviewers) || !reviewers.every((id) => typeof id === 'string')) {
		return Response.json({ error: 'reviewers must be a list of persona ids' }, { status: 400 });
	}
	setReviewers(reviewers);
	return Response.json({ ok: true });
};
