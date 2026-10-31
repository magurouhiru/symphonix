import { json } from '@sveltejs/kit';
import { deletePersona, updatePersona } from '#lib/server/personas.js';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		return json({ persona: updatePersona(params.id, await request.json()) });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		deletePersona(params.id);
		return json({ ok: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};
