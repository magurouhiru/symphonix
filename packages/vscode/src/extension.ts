// VS Code で開いているフォルダを symphonix のプレイヤーにする。
// extensionKind が workspace なので、devcontainer ではコンテナ側で動き、コンテナ内のファイルとコマンドを扱う
import path from 'node:path';
import { createPlayer, type PlayerStatus } from '@symphonix/player';
import * as vscode from 'vscode';

type Player = ReturnType<typeof createPlayer>;

export function activate(context: vscode.ExtensionContext) {
	const output = vscode.window.createOutputChannel('symphonix');
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	context.subscriptions.push(output, statusBar);
	let player: Player | undefined;

	const labels: Record<PlayerStatus, [string, string, string]> = {
		connecting: ['$(sync~spin) symphonix', '接続しています（クリックで停止）', 'symphonix.stop'],
		connected: ['$(plug) symphonix', '接続中（クリックで停止）', 'symphonix.stop'],
		stopped: ['$(debug-disconnect) symphonix', '停止中（クリックで起動）', 'symphonix.start']
	};
	function showStatus(status: PlayerStatus) {
		const [text, tooltip, command] = labels[status];
		statusBar.text = text;
		statusBar.tooltip = `symphonix のプレイヤー: ${tooltip}`;
		statusBar.command = command;
		statusBar.show();
	}

	async function pickFolder(): Promise<vscode.WorkspaceFolder | undefined> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		if (folders.length <= 1) return folders[0];
		return vscode.window.showWorkspaceFolderPick({ placeHolder: '作業フォルダにするフォルダ' });
	}

	async function start() {
		if (player) return;
		const folder = await pickFolder();
		if (!folder) {
			vscode.window.showWarningMessage('symphonix: フォルダを開いてからプレイヤーを起動してください');
			return;
		}
		if (folder.uri.scheme !== 'file') {
			vscode.window.showWarningMessage(`symphonix: このフォルダは扱えません: ${folder.uri.toString()}`);
			return;
		}
		const config = vscode.workspace.getConfiguration('symphonix', folder);
		const log = (message: string) => output.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
		player = createPlayer({
			server: config.get('server', 'http://host.docker.internal:7373'),
			root: path.resolve(folder.uri.fsPath, config.get('root', '')),
			name: config.get('name') || undefined,
			allow: config.get<string[]>('allow'),
			log,
			onStatus: showStatus
		});
		player.start().catch((e) => log(`止まりました: ${e instanceof Error ? e.message : e}`));
	}

	async function stop() {
		const current = player;
		player = undefined;
		await current?.stop();
		showStatus('stopped');
	}

	context.subscriptions.push(
		vscode.commands.registerCommand('symphonix.start', start),
		vscode.commands.registerCommand('symphonix.stop', stop),
		vscode.commands.registerCommand('symphonix.showLog', () => output.show()),
		// 設定を変えたら、動いていればつなぎ直す
		vscode.workspace.onDidChangeConfiguration(async (e) => {
			if (!player || !e.affectsConfiguration('symphonix')) return;
			await stop();
			await start();
		}),
		{ dispose: () => void player?.stop() }
	);

	showStatus('stopped');
	if (vscode.workspace.getConfiguration('symphonix').get('autoStart')) void start();
}

export function deactivate() {}
