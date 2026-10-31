import { getStatus } from '#lib/server/status.js';

// 状態ページを開いていなくても、足りないモデルのダウンロードが始まるように定期的に確認する
export const init = () => {
	const check = () => getStatus().catch(() => {});
	check();
	setInterval(check, 10_000).unref();
};
