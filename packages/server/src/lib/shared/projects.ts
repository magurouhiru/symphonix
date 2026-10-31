// 画面とサーバーで共有する、プロジェクト（プレイヤーの作業フォルダの中のフォルダ）の決まりごと

// このフォルダ名を選ぶと、フォルダを作らずに作業フォルダの直下で作業する
export const ROOT_PROJECT = '.';

export function projectLabel(project: string): string {
	return project === ROOT_PROJECT ? '作業フォルダの直下' : project;
}

// フォルダ名に「.」が来るとブラウザが URL のパスから消してしまうので、クエリで渡す
export function downloadHref(player: string, project: string): string {
	return `/api/projects/download?${new URLSearchParams({ player, project })}`;
}
