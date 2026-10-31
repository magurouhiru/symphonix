import { error } from '@sveltejs/kit';
import { zipSync } from 'fflate';
import { readProjectBytes } from '#lib/server/workspace.js';
import type { RequestHandler } from './$types';

// プロジェクトのファイルを 1 つの ZIP にまとめて返す。ZIP の中は「プロジェクト名/…」になる
export const GET: RequestHandler = async ({ params }) => {
	let files: Record<string, Uint8Array>;
	try {
		files = await readProjectBytes(params.name);
	} catch {
		error(404, 'プロジェクトが見つかりません');
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
