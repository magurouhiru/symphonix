# symphonix

作りたいものを伝えると、プランを立てて順番に実装していく自分用のウェブサーバー（試作）。
フロントエンド・サーバーは SvelteKit、モデルは [LocalAI](https://github.com/mudler/LocalAI)（文章・画像とも OpenAI 互換 API）を使います。

## 動かし方（VS Code devcontainer）

前提: Windows + WSL2 の Docker Desktop と NVIDIA GPU（ドライバーは最新にしておいてください）。

1. VS Code でこのリポジトリを開き、「Reopen in Container」を実行します。
   開発用コンテナ `symphonix-dev` と LocalAI のコンテナ `symphonix-localai` が一緒に起動し、`npm install` も自動で走ります。
   LocalAI はすぐに起動し、必要なモデル（Gemma 4 E4B、Stable Diffusion 1.5、Whisper small、Supertonic 3）は symphonix が起動後に LocalAI にダウンロードさせます。
   初回はダウンロードに時間がかかるので、進み具合は http://localhost:5173/status で確認してください。
2. コンテナ内で開発サーバーを起動します。
   ```sh
   npm run dev
   ```
3. http://localhost:5173 を開き、作りたいものを入力して「プランを作る」を押すと、ステップ一覧が表示されます（タイトル・説明の編集、並べ替え、追加、削除ができます）。
   「このプランで実装する」を押すと、ステップを 1 つずつ順番にモデルに実装させ、生成したファイルを `workspace/<日時>/` に書き出します（git には入りません）。
   実装が終わると「ZIP でダウンロード」のリンクが出ます。これまでに作ったものは http://localhost:5173/projects からまとめてダウンロードできます。
   - モデルとの接続だけを確かめたいときは http://localhost:5173/chat
   - 画像生成は http://localhost:5173/image
   - 音声で話しかけるのは http://localhost:5173/voice（録音 → 文字起こし → 返事 → 読み上げ）
   - 用途ごと（文章・画像・文字起こし・読み上げ）に使うモデルは http://localhost:5173/settings で変更できます（選んだ値は `data/settings.json` に保存）
   - LocalAI の死活と各モデルの状態（インストール済みか、メモリに読み込まれているか）と GPU 全体の VRAM 使用量は http://localhost:5173/status

VRAM 8GB に収めるため、LocalAI は同時に 1 つのモデルしか読み込みません。文章と画像を切り替えた直後の 1 回目は読み込み待ちで遅くなります。

## 設定

| 環境変数 | 既定値 | 説明 |
| --- | --- | --- |
| `AI_BASE_URL` | `http://localai:8080/v1` | LocalAI の OpenAI 互換 API |
| `MODEL` | `gemma-4-e4b-it-qat-q4_0` | 文章・コード生成に使うモデル |
| `IMAGE_MODEL` | `sd-1.5-ggml` | 画像生成に使うモデル |
| `STT_MODEL` | `whisper-small` | 文字起こしに使うモデル |
| `TTS_MODEL` | `supertonic-3` | 読み上げに使うモデル |
| `SETTINGS_PATH` | `./data/settings.json` | 画面で選んだモデルの保存先 |
| `WORKSPACE_DIR` | `./workspace` | 生成コードの書き出し先 |

モデルの環境変数は画面で何も選んでいないときの既定値です。アプリ側の値は `.devcontainer/compose.yaml` の `app` の `environment` で変えられます。
別のモデルを使うときは、`/settings` の画面か `MODEL` などの環境変数に [LocalAI のモデルギャラリー](https://models.localai.io) の名前を指定すれば、足りない分は自動でダウンロードされます。
