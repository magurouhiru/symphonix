// ペルソナの一覧と、作業ごとにどのペルソナを割り当てるかを JSON ファイルに保存する
import { randomUUID } from 'node:crypto';
import { tasks, type Persona, type Task } from './types.js';
import { roleModel } from '#lib/ai/model-settings.server.js';
import { jsonStore } from '#lib/shared/json-store.server.js';

// reviewers は実装のあとにレビューするペルソナ（複数可、空ならレビューしない）
type Store = { personas: Persona[]; assignments: Record<Task, string>; reviewers: string[] };

// 初めて起動したときのペルソナ
const initial: Store = {
	personas: [
		{
			id: 'planner',
			name: 'プランナー',
			prompt:
				'You are an experienced tech lead. You keep plans small and practical, and you order steps so that each one can be checked on its own.',
			model: ''
		},
		{
			id: 'engineer',
			name: 'エンジニア',
			prompt:
				'You are a careful full-stack engineer. You write simple, readable code with no unnecessary dependencies.',
			model: ''
		},
		{
			id: 'requirements-reviewer',
			name: '要件チェック担当',
			prompt:
				'You are a product owner. You check that the code does what the current step asks for, and nothing is missing.',
			model: ''
		},
		{
			id: 'code-reviewer',
			name: 'コードレビュー担当',
			prompt:
				'You are a senior engineer doing code review. You look for bugs, broken references between files, and code that will not run.',
			model: ''
		}
	],
	assignments: { plan: 'planner', code: 'engineer' },
	reviewers: ['requirements-reviewer', 'code-reviewer']
};

const file = jsonStore<Store>(process.env.PERSONAS_PATH ?? 'data/personas.json', {
	initial: () => structuredClone(initial),
	// レビュー機能より前に保存したファイルには、既定のレビュアーを足す
	migrate: (data) => {
		if (Array.isArray(data.reviewers)) return data;
		const extra = initial.personas.filter(
			(p) => initial.reviewers.includes(p.id) && !data.personas.some((q) => q.id === p.id)
		);
		return { ...data, personas: [...data.personas, ...extra], reviewers: [...initial.reviewers] };
	}
});
const load = file.get;
const save = file.set;

export function listPersonas(): Persona[] {
	return load().personas;
}

export function assignments(): Record<Task, string> {
	return load().assignments;
}

export function reviewerIds(): string[] {
	return load().reviewers;
}

export function setReviewers(ids: string[]) {
	const store = load();
	const known = ids.filter((id, i) => ids.indexOf(id) === i && store.personas.some((p) => p.id === id));
	save({ ...store, reviewers: known });
}

// レビューするペルソナと、実際に使うモデル
export function reviewers(): (Persona & { resolvedModel: string })[] {
	const store = load();
	return store.reviewers
		.map((id) => store.personas.find((p) => p.id === id))
		.filter((p): p is Persona => !!p)
		.map((p) => ({ ...p, resolvedModel: p.model || roleModel('chat') }));
}

function clean(input: Partial<Persona>): Omit<Persona, 'id'> {
	const name = String(input.name ?? '').trim();
	if (!name) throw new Error('名前を入力してください');
	return { name, prompt: String(input.prompt ?? '').trim(), model: String(input.model ?? '').trim() };
}

export function createPersona(input: Partial<Persona>): Persona {
	const store = load();
	const persona = { id: randomUUID(), ...clean(input) };
	save({ ...store, personas: [...store.personas, persona] });
	return persona;
}

export function updatePersona(id: string, input: Partial<Persona>): Persona {
	const store = load();
	if (!store.personas.some((p) => p.id === id)) throw new Error('ペルソナが見つかりません');
	const persona = { id, ...clean(input) };
	save({ ...store, personas: store.personas.map((p) => (p.id === id ? persona : p)) });
	return persona;
}

// 作業に割り当て中のペルソナは消せない
export function deletePersona(id: string) {
	const store = load();
	const used = tasks.filter((task) => store.assignments[task] === id);
	if (used.length || store.reviewers.includes(id)) throw new Error('作業に割り当て中のペルソナは削除できません');
	save({ ...store, personas: store.personas.filter((p) => p.id !== id) });
}

export function assign(task: Task, id: string) {
	const store = load();
	if (!store.personas.some((p) => p.id === id)) throw new Error('ペルソナが見つかりません');
	save({ ...store, assignments: { ...store.assignments, [task]: id } });
}

// 作業を担当するペルソナと、実際に使うモデル
export function personaFor(task: Task): Persona & { resolvedModel: string } {
	const store = load();
	const persona =
		store.personas.find((p) => p.id === store.assignments[task]) ?? initial.personas[task === 'plan' ? 0 : 1];
	return { ...persona, resolvedModel: persona.model || roleModel('chat') };
}

// 人物像を先に書き、出力形式の指示は必ず後ろに付ける（形式が崩れると読み取れないため）
export function withPersona(personaPrompt: string, instructions: string): string {
	return personaPrompt ? `${personaPrompt}\n\n${instructions}` : instructions;
}

// ペルソナが個別に指定しているモデル（状態ページで自動ダウンロードするため）
export function personaModels(): { model: string; name: string }[] {
	return load()
		.personas.filter((p) => p.model)
		.map((p) => ({ model: p.model, name: p.name }));
}
