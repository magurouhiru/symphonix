import { deletePersona, updatePersona } from '#lib/personas/store.server.js';
import type { RequestHandler } from './$types';
import { errorMessage } from '#lib/shared/errors.js';

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		return Response.json({ persona: updatePersona(params.id, await request.json()) });
	} catch (e) {
		return Response.json({ error: errorMessage(e) }, { status: 400 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		deletePersona(params.id);
		return Response.json({ ok: true });
	} catch (e) {
		return Response.json({ error: errorMessage(e) }, { status: 400 });
	}
};
