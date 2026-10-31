# symphonix

作りたいものを伝えると、プランを立てて順番に実装していく自分用のウェブサーバー（試作）。
フロントエンド・サーバーは SvelteKit、モデルは [LocalAI](https://github.com/mudler/LocalAI)（文章・画像とも OpenAI 互換 API）を使います。

## 構成（pnpm のモノレポ）

symphonix を指揮者、ファイルを実際に読み書きする側をプレイヤーと呼んでいます。

| パッケージ | 中身 |
| --- | --- |
| `packages/server`（`@symphonix/server`） | symphonix 本体。プランを立て、AI に実装・レビューさせ、プレイヤーに書き出させる SvelteKit サーバー |
| `packages/player`（`@symphonix/player`） | プレイヤー。作業フォルダを持ち、symphonix に接続して、ファイルの一覧・読み書きとコマンドの実行を受け持つ |
| `packages/protocol`（`@symphonix/protocol`） | 両者が共有する型と API の決まりごと |
| `packages/vscode`（`symphonix-vscode`） | プレイヤーの VS Code 拡張機能。VS Code で開いているフォルダをそのまま作業フォルダにする |

symphonix はファイルを直接触らず、生成したファイルの読み書きやビルド・テストをすべてプレイヤーに頼みます。
プレイヤーは HTTP のロングポーリングで symphonix に「次の仕事」を取りに行くので、別の devcontainer からでもつなげます。

## 動かし方（VS Code devcontainer）

前提: Windows + WSL2 の Docker Desktop と NVIDIA GPU（ドライバーは最新にしておいてください）。

1. VS Code でこのリポジトリを開き、「Reopen in Container」を実行します。
   開発用コンテナ `symphonix-dev` と LocalAI のコンテナ `symphonix-localai` が一緒に起動し、`pnpm install` も自動で走ります。
   LocalAI はすぐに起動し、必要なモデル（Gemma 4 E4B、Stable Diffusion 1.5、Whisper small、Supertonic 3）は symphonix が起動後に LocalAI にダウンロードさせます。
   初回はダウンロードに時間がかかるので、進み具合は http://localhost:5173/status で確認してください。
2. コンテナ内で開発サーバーを起動します。
   ```sh
   pnpm dev
   ```
3. 別のターミナルでプレイヤーを起動します。
   ```sh
   pnpm player   # workspace/ を作業フォルダにする
   ```
   別の devcontainer で作業したいときは、symphonix が配っている VS Code 拡張機能を入れるのが手軽です。
   VS Code に入っている Node.js で動くので、コンテナに Node.js が無くても使えます。そのコンテナの VS Code のターミナルで次を実行します。
   ```sh
   curl -fO http://host.docker.internal:5173/symphonix-player.vsix
   code --install-extension symphonix-player.vsix
   ```
   コマンドパレットの「symphonix: プレイヤーを起動」か、左下のステータスバーの「symphonix」を押すと、開いているフォルダを作業フォルダにして接続します。
   - 接続先・作業フォルダ・実行してよいコマンドは設定の `symphonix.server`、`symphonix.root`、`symphonix.allow` で変えられます。`symphonix.autoStart` を有効にすると、開いたときに自動で起動します
   - 拡張機能はコンテナ側で動く（`extensionKind: workspace`）ので、コンテナの中のファイルとコマンドを扱います
   - ログは「symphonix: ログを表示」で見られます
   - この拡張機能自体を直すときは、このリポジトリで F5 を押すと拡張機能開発ホストで試せます

   VS Code を使わない環境では、1 ファイルのプレイヤーを取ってきて実行します。Node.js 18 以上があれば、ほかに何も要りません。
   ```sh
   curl -fO http://host.docker.internal:5173/symphonix-player.js
   node symphonix-player.js --server http://host.docker.internal:5173 --root <作業フォルダ>
   ```
   symphonix のコンテナはポート 5173 を公開しているので、別のコンテナからは `host.docker.internal:5173` で届きます（Windows からは今まで通り `localhost:5173`）。
   - プレイヤーは作業フォルダの外を読み書きしません
   - 実行するコマンドは `node`、`npm`、`python3` だけです。変えるときは `--allow node,npm` のように指定します
   - `packages/player/src/player.ts` の `createPlayer` が本体で、`cli.ts` はそれを起動するだけです。VS Code 拡張からは `@symphonix/player` の `createPlayer` をそのまま使えます
4. http://localhost:5173 を開き、作りたいものを入力して「プランを作る」を押すと、ステップ一覧が表示されます（タイトル・説明の編集、並べ替え、追加、削除ができます）。
   「このプランで実装する」を押すと、ステップを 1 つずつ順番にモデルに実装させ、生成したファイルをプレイヤーの作業フォルダの `<フォルダ名>/` に書き出します（フォルダ名を空にすると日時。`workspace/` は git には入りません）。
   実装が終わると「ZIP でダウンロード」のリンクが出ます。プレイヤーの作業フォルダにあるものは http://localhost:5173/projects からまとめてダウンロードできます。
   - プラン作成と実装をどのペルソナ（人物像とモデル）に任せるかは http://localhost:5173/personas で決められます。ペルソナにモデルを指定しなければ「文章」のモデルを使います
   - 同じ画面でレビュアーを何人でも選べます。ステップを実装するたびに全員がレビューし、全員が承認したら次のステップへ進みます。指摘があれば直させ、2 回直しても承認されなければ止まるので、そのまま進めるか止めるかを選んでください
   - レビューの前に自動チェックが走ります。JSON が壊れていないか、HTML から読み込むファイルがあるか、JavaScript と Python の構文、package.json があれば `npm install`（install スクリプトは実行しない）と `npm run build` と `npm test` です。失敗したらエラーを渡して直させます
   - チェックのコマンドはプレイヤーが作業フォルダの中で実行します
   - モデルとの接続だけを確かめたいときは http://localhost:5173/chat
   - 画像生成は http://localhost:5173/image
   - 音声で話しかけるのは http://localhost:5173/voice（録音 → 文字起こし → 返事 → 読み上げ）
   - 用途ごと（文章・画像・文字起こし・読み上げ）に使うモデルは http://localhost:5173/settings で変更できます（選んだ値は `packages/server/data/settings.json` に保存）
   - LocalAI の死活と各モデルの状態（インストール済みか、メモリに読み込まれているか）と GPU 全体の VRAM 使用量は http://localhost:5173/status

型チェックとビルドはリポジトリのルートで `pnpm check`、`pnpm build` です。

VRAM 8GB に収めるため、LocalAI は同時に 1 つのモデルしか読み込みません。文章と画像を切り替えた直後の 1 回目は読み込み待ちで遅くなります。

## 設定

| 環境変数 | 既定値 | 説明 |
| --- | --- | --- |
| `AI_BASE_URL` | `http://localai:8080/v1` | LocalAI の OpenAI 互換 API |
| `MODEL` | `gemma-4-e4b-it-qat-q4_0` | 文章・コード生成に使うモデル |
| `IMAGE_MODEL` | `sd-1.5-ggml` | 画像生成に使うモデル |
| `STT_MODEL` | `whisper-small` | 文字起こしに使うモデル |
| `TTS_MODEL` | `supertonic-3` | 読み上げに使うモデル |
| `PERSONAS_PATH` | `data/personas.json`（`packages/server` から） | ペルソナと担当の保存先 |
| `SETTINGS_PATH` | `data/settings.json`（`packages/server` から） | 画面で選んだモデルの保存先 |

モデルの環境変数は画面で何も選んでいないときの既定値です。アプリ側の値は `.devcontainer/compose.yaml` の `app` の `environment` で変えられます。
別のモデルを使うときは、`/settings` の画面か `MODEL` などの環境変数に [LocalAI のモデルギャラリー](https://models.localai.io) の名前を指定すれば、足りない分は自動でダウンロードされます。
