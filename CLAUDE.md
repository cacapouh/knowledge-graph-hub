# Workflow

ユーザーから改修の指示を受けたときは、以下を毎回自動で行う。明示的な許可を都度求めない。

## 1. 検証

実装後、報告前に必ず以下を実行する。

- Backend (Python): 触ったファイルに対し `python3 -m py_compile` で構文チェック。テストがあれば pytest。
- Frontend (TypeScript): `./frontend/node_modules/.bin/tsc -b ./frontend` で型チェック。
- UI 変更: ブラウザで実際に動かして確認する。利用可能なブラウザ自動化ツール（Playwright MCP など）があれば使う。dev server (`http://localhost:5173`) と backend (`http://localhost:8000`) はすでに起動している前提でよい。
- E2E 回帰: 画面に触ったら `cd frontend && npm run test:e2e` を流す。golden-path だけだが既存の挙動が壊れていないことを確認できる (`frontend/tests/e2e/`)。

エラー・失敗があれば修正してから先に進む。テストや型チェックが通っていない状態を「完了」と報告しない。

## 2. 機能追加時のスコープ (UI / API / MCP の三面整合)

機能を追加・拡張するときは **画面・API・MCP の3面すべてで同じことができる状態** にする。片面だけ実装して完了にしない。

- **画面** (`frontend/src/pages`, `frontend/src/components`): UI を追加
- **API** (`backend/app/api/`, `backend/app/schemas/`, `backend/app/models/`): REST エンドポイントを追加または拡張
- **MCP** (`mcp_server.py`): 対応する `@mcp.tool()` を追加または拡張

新規リソースなら CRUD 4 種すべて、既存リソースに操作を足すなら同じ操作を REST と MCP の両方に追加する。データモデル / Pydantic スキーマもセットで更新。

純粋な表示系（フィルタ、ソート、ハイライト等）は画面のみでよいが、**「人が画面でできる書き込み・問い合わせは LLM が MCP からもできる」を原則** とする。

> 理由: KG Hub は Copilot / Claude Code が主要ユーザー。画面のみの機能は LLM から見えず、PHILOSOPHY の優先順位 #2「LLM が tool として叩きやすいこと」に反する。

## 3. 自動 commit

検証が通ったら、ユーザーの明示確認を求めずに commit する。

- 1つの論理単位 = 1 コミット。複数の独立した変更が含まれる場合は分割する。
- コミットメッセージは既存履歴のスタイルに合わせる (`feat:` / `fix:` / `chore:` / `refactor:` プレフィックス、英語1〜3行)。
- 変更が無い場合はスキップ。
- `--no-verify` や `--amend` はユーザーが明示的に求めない限り使わない。
- push はユーザーの明示指示があるまで行わない。

## 注意点

- 破壊的操作（`reset --hard`, `push --force`, ブランチ削除, 大量ファイル削除など）は事前に確認を取る。自動 commit の対象外。
- `.env` などシークレットを含む可能性があるファイルは commit しない。
