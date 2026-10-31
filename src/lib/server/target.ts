// リクエストの { client, project } を読む。どちらも無ければ null
import type { Target } from './workspace.js';

export function targetFrom(body: { client?: unknown; project?: unknown }): Target | null {
	if (typeof body.client !== 'string' || !body.client) return null;
	if (typeof body.project !== 'string' || !body.project) return null;
	return { client: body.client, project: body.project };
}
