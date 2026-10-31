import { error } from '@sveltejs/kit';
import { zipSync } from 'fflate';
import { readProjectBytes } from '#lib/players/workspace.server.js';
import type { RequestHandler } from './$types';
import { errorMessage } from '#lib/shared/errors.js';

// プロジェクトのファイルを 1 つの ZIP にまとめて返す（?player=プレイヤーの id）。ZIP の中は「プロジェクト名/…」になる
export const GET: RequestHandler = async ({ params, url }) => {
	const player = url.searchParams.get('player');
	if (!player) error(400, 'player is required');
	let files: Record<string, Uint8Array>;
	try {
		files = await readProjectBytes({ player, project: params.name });
	} catch (e) {
		error(404, errorMessage(e));
	}
	if (Object.keys(files).length === 0) error(404, 'プロジェクトにファイルがありません');
	const zip = zipSync({ [params.name]: files });
	return new Response(zip, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="${encodeURIComponent(params.name)}.zip"`
		}
	});
};
