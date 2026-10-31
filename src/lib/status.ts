export type ServerState = 'ready' | 'starting' | 'down';

export type DownloadStatus = {
	progress: number;
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
