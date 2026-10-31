import { error } from '@sveltejs/kit';
import { zipSync } from 'fflate';
import { listPlayers } from '#lib/players/registry.server.js';
import { readProjectBytes } from '#lib/players/workspace.server.js';
import { ROOT_PROJECT } from '#lib/shared/projects.js';
import type { RequestHandler } from './$types';
import { errorMessage } from '#lib/shared/errors.js';

// プロジェクトのファイルを 1 つの ZIP にまとめて返す（?player=プレイヤーの id&project=フォルダ名）。
// ZIP の中は「プロジェクト名/…」になる。作業フォルダの直下なら、プレイヤーの名前を使う
export const GET: RequestHandler = async ({ url }) => {
	const player = url.searchParams.get('player');
	const project = url.searchParams.get('project');
	if (!player || !project) error(400, 'player and project are required');
	let files: Record<string, Uint8Array>;
	try {
		files = await readProjectBytes({ player, project });
	} catch (e) {
		error(404, errorMessage(e));
	}
	if (Object.keys(files).length === 0) error(404, 'プロジェクトにファイルがありません');
	const name =
		project === ROOT_PROJECT ? (listPlayers().find((p) => p.id === player)?.name ?? 'workspace') : project;
	const zip = zipSync({ [name]: files });
	return new Response(zip, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}.zip"`
		}
	});
};
