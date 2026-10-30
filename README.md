# symphonix

作りたいものを伝えると、プランを立てて順番に実装していく自分用のウェブサーバー（試作）。
フロントエンド・サーバーは SvelteKit、モデルは Docker Desktop の Model Runner のみを使います。

## 動かし方（VS Code devcontainer）

1. Docker Desktop の設定で Model Runner を有効にし、モデルを取得します。
   ```sh
   docker model pull ai/gemma4:e4b
   ```
2. VS Code でこのリポジトリを開き、「Reopen in Container」を実行します（`npm install` は自動で走ります）。
3. コンテナ内で開発サーバーを起動します。
   ```sh
   npm run dev
   ```
4. http://localhost:5173 を開き、作りたいものを入力して「プランを作る」を押すと、ステップ一覧が表示されます（タイトル・説明の編集、並べ替え、追加、削除ができます）。
   「このプランで実装する」を押すと、ステップを 1 つずつ順番にモデルに実装させ、生成したファイルを `workspace/<日時>/` に書き出します（git には入りません）。
   モデルとの接続だけを確かめたいときは http://localhost:5173/chat を使ってください。

## 設定

| 環境変数 | 既定値 | 説明 |
| --- | --- | --- |
| `MODEL_RUNNER_URL` | `http://model-runner.docker.internal/engines/v1` | Model Runner の OpenAI 互換 API |
| `MODEL` | `ai/gemma4:e4b` | 使うモデル |
| `MODEL_RUNNER_IMAGE_URL` | `http://model-runner.docker.internal/engines/diffusers/v1` | Model Runner の画像生成 API |
| `IMAGE_MODEL` | `ai/stable-diffusion:Q4` | 画像生成に使うモデル |
| `WORKSPACE_DIR` | `./workspace` | 生成コードの書き出し先 |

どちらも `.devcontainer/devcontainer.json` の `containerEnv` で変更できます。

## 画像生成（試作）

http://localhost:5173/image でプロンプトを入れると、Model Runner の Diffusers エンジンで画像を生成します。
事前にホスト側で次を実行してください。

```sh
docker model reinstall-runner --backend diffusers --gpu cuda
docker model pull ai/stable-diffusion:Q4
```

Docker のドキュメントでは Diffusers エンジンは Linux + NVIDIA GPU のみ対応で、Windows / macOS は未対応とされています。
