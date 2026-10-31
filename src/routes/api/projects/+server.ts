import { json } from '@sveltejs/kit';
import { listProjects } from '#lib/server/workspace.js';
import type { RequestHandler } from './$types';

// これまでに作ったプロジェクトの一覧
export const GET: RequestHandler = async () => json({ projects: await listProjects() });
