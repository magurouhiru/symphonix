import { json } from '@sveltejs/kit';
import { roles, type Role } from '#lib/ai/models.js';
import { defaultModel, roleModels, setRoleModel } from '#lib/ai/model-settings.server.js';
import type { RequestHandler } from './$types';

// 用途ごとに今使っているモデルと既定のモデルを返す
export const GET: RequestHandler = async () => {
	const current = roleModels();
	return json({
		models: Object.fromEntries(
			roles.map((role) => [role, { model: current[role], default: defaultModel(role) }])
		)
	});
};

// { role, model } で用途のモデルを変える。model が空なら既定に戻す
export const PUT: RequestHandler = async ({ request }) => {
	const { role, model } = await request.json();
	if (!roles.includes(role) || typeof model !== 'string') {
		return json({ error: 'role and model are required' }, { status: 400 });
	}
	setRoleModel(role as Role, model);
	return json({ ok: true, model: roleModels()[role as Role] });
};
