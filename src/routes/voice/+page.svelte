<script lang="ts">
	let recorder: MediaRecorder | null = null;
	let chunks: Blob[] = [];
	let recording = $state(false);
	let status = $state('');
	let heard = $state('');
	let reply = $state('');
	let audioUrl = $state('');
	let error = $state('');
	let ttsModel = $state('supertonic-3');

	async function start() {
		error = '';
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			recorder = new MediaRecorder(stream);
			chunks = [];
			recorder.ondataavailable = (e) => chunks.push(e.data);
			recorder.onstop = () => {
				stream.getTracks().forEach((t) => t.stop());
				handle(new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }));
			};
			recorder.start();
			recording = true;
		} catch (e) {
			error = `マイクを使えませんでした: ${e}`;
		}
	}

	function stop() {
		recorder?.stop();
		recording = false;
	}

	// 録音 → 文字起こし → チャット → 読み上げ、の順に進める
	async function handle(audio: Blob) {
		heard = '';
		reply = '';
		audioUrl = '';
		try {
			status = '文字起こし中…';
			let res = await fetch('/api/transcribe', {
				method: 'POST',
				headers: { 'Content-Type': audio.type },
				body: audio
			});
			let data = await res.json();
			if (!res.ok) throw new Error(data.error);
			heard = data.text;

			status = '返事を考え中…';
			res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: heard })
			});
			data = await res.json();
			if (!res.ok) throw new Error(data.error);
			reply = data.reply;

			status = '読み上げ音声を作成中…';
			res = await fetch('/api/speech', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: reply, model: ttsModel })
			});
			if (!res.ok) throw new Error((await res.json()).error);
			audioUrl = URL.createObjectURL(await res.blob());
			status = '';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			status = '';
		}
	}
</script>

<h1>symphonix</h1>
<p><a href="/">プラン作成に戻る</a> | 音声で話しかける</p>

<p>
	読み上げモデル:
	<select bind:value={ttsModel}>
		<option value="supertonic-3">Supertonic 3（軽量・多言語）</option>
		<option value="audio-cpp-irodori-voicedesign">Irodori（日本語向け）</option>
	</select>
</p>

{#if recording}
	<button onclick={stop}>■ 録音を止めて送る</button>
{:else}
	<button onclick={start} disabled={!!status}>● 録音開始</button>
{/if}

{#if status}
	<p>{status}</p>
{/if}
{#if heard}
	<p>あなた: {heard}</p>
{/if}
{#if reply}
	<p>モデル: {reply}</p>
{/if}
{#if audioUrl}
	<audio src={audioUrl} controls autoplay></audio>
{/if}
{#if error}
	<p style="color: red">{error}</p>
{/if}
