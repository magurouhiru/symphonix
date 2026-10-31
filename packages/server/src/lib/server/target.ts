// リクエストの { player, project } を読む。どちらも無ければ null
import type { Target } from './workspace.js';

export function targetFrom(body: { player?: unknown; project?: unknown }): Target | null {
	if (typeof body.player !== 'string' || !body.player) return null;
	if (typeof body.project !== 'string' || !body.project) return null;
	return { player: body.player, project: body.project };
}
