// 日本語が苦手なモデルのために、翻訳用のモデル（既定は Gemma）で日本語と英語を訳す
import { chat } from './chat.server.js';
import { roleModel } from './model-settings.server.js';

export type Language = 'en' | 'ja';

const names: Record<Language, string> = { en: 'English', ja: 'Japanese' };
const japanese = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;

// 同じ依頼やプランを何度も訳さないよう、訳した結果を覚えておく
const cache = new Map<string, string>();
const CACHE_SIZE = 500;

function remember(key: string, value: string) {
	cache.set(key, value);
	if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
}

// 日本語を含まない文を英語に訳す必要はない（日本語に訳すときは、日本語が含まれていれば訳さない）
function needsTranslation(text: string, to: Language): boolean {
	if (!text.trim()) return false;
	return to === 'en' ? japanese.test(text) : !japanese.test(text);
}

const PROMPT = (to: Language) => `You are a translator. Translate the user's text into ${names[to]}.
Keep the meaning exact. Keep code, file paths, commands, identifiers, URLs and line numbers exactly as they are.
Keep the formatting: line breaks, lists and markers such as "=== FILE: ... ===".
Respond with the translation only.`;

export async function translate(text: string, to: Language): Promise<string> {
	if (!needsTranslation(text, to)) return text;
	const key = `${to}\n${text}`;
	const hit = cache.get(key);
	if (hit !== undefined) return hit;
	const result = (
		await chat(
			[
				{ role: 'system', content: PROMPT(to) },
				{ role: 'user', content: text }
			],
			roleModel('translate')
		)
	).trim();
	remember(key, result);
	// 訳したものを訳し戻すとき（日本語にしたプランを実装に渡すときなど）は、元の文をそのまま使う
	remember(`${to === 'en' ? 'ja' : 'en'}\n${result}`, text);
	return result;
}

// まとめて訳す。小さいモデルに 1 回で頼むと数がずれやすいので、1 つずつ順に訳す
export async function translateAll(texts: string[], to: Language): Promise<string[]> {
	const results: string[] = [];
	for (const text of texts) results.push(await translate(text, to));
	return results;
}

// ペルソナに渡す文章と、ペルソナが返した文章を訳す。translate が付いていなければそのまま
export function translatorFor(persona: { translate?: boolean }) {
	const on = persona.translate === true;
	return {
		toModel: (text: string) => (on ? translate(text, 'en') : Promise.resolve(text)),
		fromModel: (text: string) => (on ? translate(text, 'ja') : Promise.resolve(text)),
		steps: async <T extends { title: string; description: string }>(steps: T[], to: Language): Promise<T[]> => {
			if (!on) return steps;
			const out: T[] = [];
			for (const s of steps) {
				out.push({ ...s, title: await translate(s.title, to), description: await translate(s.description, to) });
			}
			return out;
		}
	};
}
