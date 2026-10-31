import { json } from '@sveltejs/kit';
import { nextJob } from '#lib/server/clients.js';
import type { RequestHandler } from './$types';

// 毎回つなぎ直させる。symphonix を再起動したとき、終了待ちの古いプロセスに
// 同じ接続でつながり続けて、新しいプロセスに気づかないのを防ぐ
const headers = { Connection: 'close' };

// クライアントが次の仕事を待つ（ロングポーリング）。仕事が無ければ 204
export const GET: RequestHandler = async ({ params, request }) => {
	const waiting = nextJob(params.id, request.signal);
	if (!waiting) return json({ error: '接続し直してください' }, { status: 404, headers });
	const job = await waiting;
	return job ? json(job, { headers }) : new Response(null, { status: 204, headers });
};
