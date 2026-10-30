# symphonix

作りたいものを伝えると、プランを立てて順番に実装していく自分用のウェブサーバー（試作）。
フロントエンド・サーバーは SvelteKit、モデルは Docker Desktop の Model Runner のみを使います。

## 動かし方（VS Code devcontainer）

1. Docker Desktop の設定で Model Runner を有効にし、モデルを取得します。
   ```sh
   docker model pull ai/smollm2
   ```
2. VS Code でこのリポジトリを開き、「Reopen in Container」を実行します（`npm install` は自動で走ります）。
3. コンテナ内で開発サーバーを起動します。
   ```sh
   npm run dev
   ```
4. http://localhost:5173 を開き、メッセージを送ってモデルの返答が表示されれば接続 OK です。

## 設定

| 環境変数 | 既定値 | 説明 |
| --- | --- | --- |
| `MODEL_RUNNER_URL` | `http://model-runner.docker.internal/engines/v1` | Model Runner の OpenAI 互換 API |
| `MODEL` | `ai/smollm2` | 使うモデル |

どちらも `.devcontainer/devcontainer.json` の `containerEnv` で変更できます。
