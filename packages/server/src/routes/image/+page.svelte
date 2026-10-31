<script lang="ts">
	let prompt = $state('');
	let size = $state('512x512');
	let image = $state('');
	let error = $state('');
	let loading = $state(false);

	async function send(event: SubmitEvent) {
		event.preventDefault();
		loading = true;
		image = '';
		error = '';
		try {
			const res = await fetch('/api/image', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, size })
			});
			const data = await res.json();
			if (res.ok) image = `data:image/png;base64,${data.b64}`;
			else error = data.error;
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}
</script>

<h1>symphonix</h1>
<p><a href="/">プラン作成に戻る</a> | 画像生成の確認</p>

<form onsubmit={send}>
	<textarea bind:value={prompt} rows="3" cols="60" placeholder="生成したい画像（英語のほうが通りやすいです）"></textarea>
	<div>
		<select bind:value={size}>
			<option>512x512</option>
			<option>768x768</option>
		</select>
		<button type="submit" disabled={loading || !prompt.trim()}>{loading ? '生成中…' : '生成'}</button>
	</div>
</form>

{#if image}
	<img src={image} alt={prompt} />
{/if}
{#if error}
	<p style="color: red">{error}</p>
{/if}
