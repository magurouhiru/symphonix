export type ServerState = 'ready' | 'starting' | 'down';

export type DownloadStatus = {
	// queued: 順番待ち、downloading: ダウンロード中、failed: 失敗
	state: 'queued' | 'downloading' | 'failed';
	// 順番待ちのとき、何番目か（1 から）
	position?: number;
	progress: number;
	file?: string;
	downloaded?: string;
	total?: string;
	message?: string;
	error?: string;
};

export type ModelStatus = {
	id: string;
	roles: string[];
	installed: boolean;
	loaded: boolean;
	backend?: string;
	vramBytes?: number;
	download?: DownloadStatus;
};

export type StatusReport = {
	server: ServerState;
	reason?: string;
	version?: string;
	backends: string[];
	models: ModelStatus[];
	checkedAt: string;
};
