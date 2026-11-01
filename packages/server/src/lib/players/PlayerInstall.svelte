<script lang="ts">
	// 別の devcontainer にプレイヤー（VS Code 拡張機能）を入れるコマンドを、コピーしやすい形で出す
	let { open = false } = $props();

	// 別のコンテナからは localhost では届かないので host.docker.internal にする
	const server = (() => {
		if (typeof location === 'undefined') return 'http://host.docker.internal:7373';
		const url = new URL(location.origin);
		if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) url.hostname = 'host.docker.internal';
		return url.origin;
	})();
	const command = `curl -fO ${server}/symphonix-player.vsix && code --install-extension symphonix-player.vsix`;

	let copied = $state(false);
	async function copy() {
		try {
			await navigator.clipboard.writeText(command);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// クリップボードが使えないときは、選択だけしておく
			const range = document.createRange();
			range.selectNodeContents(document.getElementById('vsix-command')!);
			getSelection()?.removeAllRanges();
			getSelection()?.addRange(range);
		}
	}
</script>

<details {open}>
	<summary>別のコンテナにプレイヤー（VS Code 拡張機能）を入れる</summary>
	<p>そのコンテナの VS Code のターミナルで実行してください。</p>
	<div class="command">
		<pre id="vsix-command">{command}</pre>
		<button type="button" onclick={copy}>{copied ? 'コピーしました' : 'コピー'}</button>
	</div>
	<p>
		入れたら、コマンドパレットの「symphonix: プレイヤーを起動」か、左下のステータスバーの「symphonix」で接続します。
	</p>
</details>

<style>
	.command {
		display: flex;
		align-items: flex-start;
		gap: 0.5em;
	}
	pre {
		margin: 0;
		padding: 0.5em;
		background: #f4f4f4;
		white-space: pre-wrap;
		word-break: break-all;
		user-select: all;
	}
</style>
