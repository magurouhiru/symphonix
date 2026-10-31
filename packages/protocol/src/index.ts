// symphonix 本体（指揮者）とプレイヤー（作業フォルダで実際に手を動かす側）のあいだの決まりごと。
// プレイヤーは symphonix に接続し、「次の仕事」を取りに行って（ロングポーリング）、結果を返す

// プレイヤーが symphonix に送る API のパス
export const playerApi = {
	connect: '/api/players/connect',
	next: (id: string) => `/api/players/${encodeURIComponent(id)}/next`,
	result: (id: string) => `/api/players/${encodeURIComponent(id)}/result`
} as const;

// プレイヤーが /next で待つ時間（ミリ秒）。これより長く間が空いたら切れたとみなす
export const POLL_MS = 25_000;

// npm install やビルドで増えるので、一覧に出さないフォルダ
export const IGNORED_DIRS = ['node_modules', '.git', 'dist'] as const;

// プレイヤーが既定で実行してよいコマンド
export const DEFAULT_ALLOW = ['node', 'npm', 'python3'] as const;

export type ConnectRequest = { name: string; root: string; allow: string[] };
export type ConnectResponse = { id: string };

// 仕事の種類ごとの引数と結果。パスはすべてプレイヤーの作業フォルダからの相対パス（/ 区切り）
export type Entry = { path: string; type: 'file' | 'dir'; mtimeMs: number; size?: number };
export type Methods = {
	// dir の中のファイルとフォルダ。depth を省くとすべての階層
	list: { params: { dir?: string; depth?: number }; result: { entries: Entry[] } };
	// バイナリでも壊れないよう base64 で返す
	read: { params: { path: string }; result: { base64: string } };
	write: { params: { path: string; content: string }; result: { ok: true } };
	// シェルを通さず、許可したコマンドだけを実行する。output は末尾だけ
	run: {
		params: { cwd?: string; command: string[]; timeoutMs?: number };
		result: { code: number; output: string; timedOut: boolean };
	};
};
export type Method = keyof Methods;

export type Job<M extends Method = Method> = { id: string; method: M; params: Methods[M]['params'] };
export type JobReply = { jobId: string; result?: unknown; error?: string };

// symphonix の画面に出すプレイヤーの情報
export type PlayerInfo = { id: string; name: string; root: string; allow: string[]; connected: boolean };
