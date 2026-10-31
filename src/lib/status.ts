export type ServerState = 'ready' | 'starting' | 'down';

export type ModelStatus = {
	id: string;
	roles: string[];
	installed: boolean;
	loaded: boolean;
	backend?: string;
	vramBytes?: number;
};

export type StatusReport = {
	server: ServerState;
	reason?: string;
	version?: string;
	backends: string[];
	models: ModelStatus[];
	checkedAt: string;
};
