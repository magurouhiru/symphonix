<script lang="ts">
	let prompt = $state('');
	let size = $state('512x512');
	let image = $state('');
	let error = $state('');
	let loading = $state(false);
	let toEnglish = $state(true);
	// 実際に画像のモデルに渡した文（英訳したときはその訳）
	let used = $state('');

	async function send(event: SubmitEvent) {
		event.preventDefault();
		loading = true;
		image = '';
		used = '';
		error = '';
		try {
			const res = await fetch('/api/image', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, size, translate: toEnglish })
			});
			const data = await res.json();
			if (res.ok) {
				image = `data:image/png;base64,${data.b64}`;
				used = data.prompt;
			}
			else error = data.error;
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}
</script>

<form onsubmit={send}>
	<textarea bind:value={prompt} rows="3" cols="60" placeholder="生成したい画像"></textarea>
	<div>
		<select bind:value={size}>
			<option>512x512</option>
			<option>768x768</option>
		</select>
		<label><input type="checkbox" bind:checked={toEnglish} /> 英語に訳してから生成する</label>
		<button type="submit" disabled={loading || !prompt.trim()}>{loading ? '生成中…' : '生成'}</button>
	</div>
</form>

{#if image}
	{#if used !== prompt}<p><small>英訳: {used}</small></p>{/if}
	<img src={image} alt={prompt} />
{/if}
{#if error}
	<p style="color: red">{error}</p>
{/if}
