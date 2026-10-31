import { error } from '@sveltejs/kit';
import { zipSync } from 'fflate';
import { readProjectBytes } from '#lib/server/workspace.js';
import type { RequestHandler } from './$types';

// プロジェクトのファイルを 1 つの ZIP にまとめて返す（?client=クライアントの id）。ZIP の中は「プロジェクト名/…」になる
export const GET: RequestHandler = async ({ params, url }) => {
	const client = url.searchParams.get('client');
	if (!client) error(400, 'client is required');
	let files: Record<string, Uint8Array>;
	try {
		files = await readProjectBytes({ client, project: params.name });
	} catch (e) {
		error(404, e instanceof Error ? e.message : 'プロジェクトが見つかりません');
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
