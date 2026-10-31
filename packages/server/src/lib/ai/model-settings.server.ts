// 用途ごとに使うモデルの設定。画面から変えた値を JSON ファイルに保存し、
// 未設定の用途は環境変数、それもなければ既定のモデルを使う
import { jsonStore } from '#lib/shared/json-store.server.js';
import { roles, type Role } from './models.js';

const defaults: Record<Role, string> = {
	chat: process.env.MODEL ?? 'gemma-4-e4b-it-qat-q4_0',
	translate: process.env.TRANSLATE_MODEL ?? 'gemma-4-e4b-it-qat-q4_0',
	image: process.env.IMAGE_MODEL ?? 'sd-1.5-ggml',
	stt: process.env.STT_MODEL ?? 'whisper-small',
	tts: process.env.TTS_MODEL ?? 'supertonic-3'
};

type Settings = { models?: Partial<Record<Role, string>> };

const file = jsonStore<Settings>(process.env.SETTINGS_PATH ?? 'data/settings.json', { initial: () => ({}) });
const load = file.get;

export function defaultModel(role: Role): string {
	return defaults[role];
}

export function roleModel(role: Role): string {
	return load().models?.[role] || defaults[role];
}

export function roleModels(): Record<Role, string> {
	return Object.fromEntries(roles.map((role) => [role, roleModel(role)])) as Record<Role, string>;
}

// model を空にすると既定のモデルに戻す
export function setRoleModel(role: Role, model: string) {
	const settings = load();
	const models = { ...settings.models };
	if (model.trim()) models[role] = model.trim();
	else delete models[role];
	file.set({ ...settings, models });
}
