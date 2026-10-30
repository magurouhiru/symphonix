# symphonix

作りたいものを伝えると、プランを立てて順番に実装していく自分用のウェブサーバー（試作）。
フロントエンド・サーバーは SvelteKit、モデルは [LocalAI](https://github.com/mudler/LocalAI)（文章・画像とも OpenAI 互換 API）を使います。

## 動かし方（VS Code devcontainer）

前提: Windows + WSL2 の Docker Desktop と NVIDIA GPU（ドライバーは最新にしておいてください）。

1. VS Code でこのリポジトリを開き、「Reopen in Container」を実行します。
   開発用コンテナ `symphonix-dev` と LocalAI のコンテナ `symphonix-localai` が一緒に起動し、`npm install` も自動で走ります。
   初回は LocalAI がモデル（Gemma 4 E4B、Stable Diffusion 1.5、Whisper small、Kokoro 日本語）をダウンロードするので時間がかかります。
   進み具合は http://localhost:8080 の LocalAI の画面か、`docker logs -f symphonix-localai` で確認できます。
2. コンテナ内で開発サーバーを起動します。
   ```sh
   npm run dev
   ```
3. http://localhost:5173 を開き、作りたいものを入力して「プランを作る」を押すと、ステップ一覧が表示されます（タイトル・説明の編集、並べ替え、追加、削除ができます）。
   「このプランで実装する」を押すと、ステップを 1 つずつ順番にモデルに実装させ、生成したファイルを `workspace/<日時>/` に書き出します（git には入りません）。
   - モデルとの接続だけを確かめたいときは http://localhost:5173/chat
   - 画像生成は http://localhost:5173/image
   - 音声で話しかけるのは http://localhost:5173/voice（録音 → 文字起こし → 返事 → 読み上げ）

VRAM 8GB に収めるため、LocalAI は同時に 1 つのモデルしか読み込みません。文章と画像を切り替えた直後の 1 回目は読み込み待ちで遅くなります。

## 設定

| 環境変数 | 既定値 | 説明 |
| --- | --- | --- |
| `AI_BASE_URL` | `http://localai:8080/v1` | LocalAI の OpenAI 互換 API |
| `MODEL` | `gemma-4-e4b-it-qat-q4_0` | 文章・コード生成に使うモデル |
| `IMAGE_MODEL` | `sd-1.5-ggml` | 画像生成に使うモデル |
| `STT_MODEL` | `whisper-small` | 文字起こしに使うモデル |
| `TTS_MODEL` | `kokoros-ja` | 読み上げに使うモデル |
| `WORKSPACE_DIR` | `./workspace` | 生成コードの書き出し先 |

アプリ側の値は `.devcontainer/compose.yaml` の `app` の `environment` で変えられます。
別のモデルを使うときは、同じファイルの `localai` の `command` に [LocalAI のモデルギャラリー](https://models.localai.io) の名前を追加してください。
