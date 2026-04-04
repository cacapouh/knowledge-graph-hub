# Foundry — Knowledge Graph & Data Platform

Palantir Foundry にインスパイアされた、オントロジーベースの知識グラフ＆データプラットフォームです。

## アーキテクチャ

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Frontend    │────▶│   Backend     │────▶│  PostgreSQL   │
│  React + TS   │     │   FastAPI     │     │               │
│  TailwindCSS  │     │  SQLAlchemy   │     └───────────────┘
└───────────────┘     │               │     ┌───────────────┐
                      │               │────▶│    Redis      │
                      │               │     └───────────────┘
                      │               │     ┌───────────────┐
                      │               │────▶│    MinIO      │
                      └───────────────┘     │ (Object Store)│
                                            └───────────────┘
```

## 機能

### Phase 1 (実装済み)
- **認証**: ユーザー登録・ログイン (JWT)
- **プロジェクト管理**: プロジェクトの CRUD
- **データセット管理**: データセットの CRUD、ファイルアップロード (MinIO)
- **オントロジー**:
  - オブジェクト型の定義 (名前、プロパティ、色、アイコン)
  - プロパティ型の定義 (データ型、必須、インデックス)
  - リンク型の定義 (ソース・ターゲット、カーディナリティ)
  - アクション型の定義
  - オブジェクトインスタンスの CRUD
  - リンクインスタンスの CRUD
  - Object Explorer (オブジェクト閲覧・検索)
- **パイプライン**: パイプラインの CRUD、ステップ定義、実行トリガー

### Phase 2 (今後)
- データセットへのファイルアップロード (MinIO 統合)
- パイプライン実行エンジン (バックグラウンドワーカー)
- オントロジーのインターフェース機能
- データセットスキーマの自動検出
- グラフ可視化 (Object Explorer の強化)
- 全文検索 (PostgreSQL tsvector / Elasticsearch)

### Phase 3 (将来)
- Pipeline Builder (ビジュアルエディタ)
- Workshop (アプリケーションビルダー)
- Quiver (分析ダッシュボード)
- モデル統合 (ML モデルの登録・デプロイ)
- AIP (AI エージェント)

## 起動方法

### 前提条件
- Docker & Docker Compose

### 起動

```bash
# 環境変数ファイルをコピー
cp .env.example .env

# 全サービスを起動
docker compose up --build
```

### アクセス
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs (Swagger)**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001

### 初期セットアップ
1. http://localhost:5173 にアクセス
2. 「Register」からユーザーを作成
3. プロジェクトを作成
4. オントロジーでオブジェクト型を定義
5. オブジェクトインスタンスを作成・探索

## 開発

### バックエンド (Python)
```bash
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

### フロントエンド (React)
```bash
cd frontend
npm install
npm run dev
```

### DB マイグレーション
```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## API エンドポイント一覧

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | ユーザー登録 |
| POST | `/api/auth/login` | ログイン |
| GET | `/api/auth/me` | 現在のユーザー |
| GET/POST | `/api/projects` | プロジェクト一覧/作成 |
| GET/PATCH/DELETE | `/api/projects/:id` | プロジェクト詳細/更新/削除 |
| GET/POST | `/api/datasets` | データセット一覧/作成 |
| GET/PATCH/DELETE | `/api/datasets/:id` | データセット詳細/更新/削除 |
| POST | `/api/datasets/:id/upload` | ファイルアップロード |
| GET/POST | `/api/ontology/object-types` | オブジェクト型一覧/作成 |
| GET/PATCH/DELETE | `/api/ontology/object-types/:id` | オブジェクト型詳細/更新/削除 |
| GET | `/api/ontology/object-types/:id/properties` | プロパティ一覧 |
| POST/DELETE | `/api/ontology/properties` | プロパティ作成/削除 |
| GET/POST | `/api/ontology/link-types` | リンク型一覧/作成 |
| GET/POST | `/api/ontology/objects` | オブジェクト一覧/作成 |
| GET/PATCH/DELETE | `/api/ontology/objects/:id` | オブジェクト詳細/更新/削除 |
| GET | `/api/ontology/objects/:id/links` | リンク一覧 |
| POST/DELETE | `/api/ontology/links` | リンク作成/削除 |
| GET/POST | `/api/pipelines` | パイプライン一覧/作成 |
| GET/PATCH/DELETE | `/api/pipelines/:id` | パイプライン詳細/更新/削除 |
| POST | `/api/pipelines/:id/run` | パイプライン実行 |

## データモデル

```
User ──┬── Project ──┬── ObjectType ──── PropertyType
       │             │             └──── ObjectInstance ── LinkInstance
       │             ├── LinkType
       │             ├── ActionType
       │             ├── Dataset ── DatasetVersion
       │             └── Pipeline ──┬── PipelineStep
       │                            └── PipelineRun
       └── Interface
```
