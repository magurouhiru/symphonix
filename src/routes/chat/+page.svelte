<script lang="ts">
	let prompt = $state('');
	let reply = $state('');
	let error = $state('');
	let loading = $state(false);

	async function send(event: SubmitEvent) {
		event.preventDefault();
		loading = true;
		reply = '';
		error = '';
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt })
			});
			const data = await res.json();
			if (res.ok) reply = data.reply;
			else error = data.error;
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}
</script>

<h1>symphonix</h1>
<p>Docker Model Runner との接続確認</p>

<form onsubmit={send}>
	<textarea bind:value={prompt} rows="4" cols="60" placeholder="モデルへのメッセージ"></textarea>
	<div>
		<button type="submit" disabled={loading || !prompt.trim()}>{loading ? '送信中…' : '送信'}</button>
	</div>
</form>

{#if reply}
	<pre>{reply}</pre>
{/if}
{#if error}
	<p style="color: red">{error}</p>
{/if}
