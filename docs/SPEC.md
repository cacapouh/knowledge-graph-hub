# Knowledge Graph Hub (KG Hub) — 仕様書

> **バージョン:** 0.2.0  
> **最終更新:** 2026-04-04  
> **ステータス:** Phase 2 実装中

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [システムアーキテクチャ](#2-システムアーキテクチャ)
3. [データモデル](#3-データモデル)
4. [バックエンド API 仕様](#4-バックエンド-api-仕様)
5. [フロントエンド仕様](#5-フロントエンド仕様)
6. [MCP サーバー](#6-mcp-サーバー)
7. [インフラストラクチャ](#7-インフラストラクチャ)
8. [チュートリアルシナリオ](#8-チュートリアルシナリオ)
9. [ロードマップ](#9-ロードマップ)

---

## 1. プロジェクト概要

### 1.1 目的

Knowledge Graph Hub (KG Hub) は、オントロジーベースのナレッジグラフ＆データプラットフォームである。
組織の暗黙知（サーバー構成、チーム体制、アプリ構成、DB テーブル、ログパイプライン、Trino テーブルなど）を
構造化されたグラフとして管理し、誰でも検索・参照可能な状態にすることを目的とする。

### 1.2 主な機能

| 機能 | 説明 |
|------|------|
| **プロジェクト管理** | ナレッジグラフを論理的に分離するプロジェクト単位の管理 |
| **オントロジー定義** | オブジェクトタイプ、プロパティタイプ、リンクタイプによるスキーマ定義 |
| **オブジェクトエクスプローラ** | オブジェクトインスタンスの CRUD、リンク関係の操作 |
| **グラフビュー** | React Flow による対話型グラフ可視化（フィルタ、エッジカラーリング、ノードハイライト） |
| **データセット管理** | CSV/JSON/Parquet 形式のデータセット管理 |
| **MCP サーバー** | GitHub Copilot 等の AI エージェントからナレッジグラフを操作する MCP インタフェース |
| **チュートリアル** | インフラ管理シナリオによる対話型学習ガイド |

### 1.3 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | React 18.3 / TypeScript 5.5 / Vite 5.4 / TailwindCSS 3.4 |
| バックエンド | Python 3.14 / FastAPI / SQLAlchemy 2.0 (async) |
| データベース | SQLite (aiosqlite) — 本番は PostgreSQL 対応 |
| 状態管理 | TanStack React Query v5 |
| グラフ描画 | React Flow (reactflow) |
| アイコン | Lucide React |
| ルーティング | React Router v6 |
| MCP | mcp SDK (Python) — stdio トランスポート |

---

## 2. システムアーキテクチャ

### 2.1 全体構成

```
┌──────────────────────────────────────────────────────────┐
│                     ブラウザ                              │
│  React SPA (localhost:5173)                              │
│  ┌─────────┬──────────┬──────────┬───────────┬────────┐  │
│  │Dashboard│Projects  │Ontology  │Datasets   │Graph   │  │
│  └────┬────┴────┬─────┴────┬─────┴─────┬─────┴───┬────┘  │
│       └─────────┴──────────┴───────────┴─────────┘       │
│                         │ HTTP (fetch)                    │
└─────────────────────────┼────────────────────────────────┘
                          │  /api/*
┌─────────────────────────┼────────────────────────────────┐
│               FastAPI (localhost:8001)                    │
│  ┌──────────┬───────────┬──────────┐                     │
│  │ Projects │ Datasets  │ Ontology │                     │
│  │ Router   │ Router    │ Router   │                     │
│  └────┬─────┴─────┬─────┴────┬─────┘                     │
│       └───────────┴──────────┘                           │
│                         │ SQLAlchemy (async)              │
│  ┌──────────────────────┴──────────────────────────────┐ │
│  │              SQLite (kghub.db)                       │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
                          ▲
                          │ HTTP (httpx)
┌─────────────────────────┼────────────────────────────────┐
│            MCP Server (stdio)                            │
│  mcp_server.py — 18 tools                                │
│  GitHub Copilot / AI Agent から呼び出し                    │
└──────────────────────────────────────────────────────────┘
```

### 2.2 ディレクトリ構成

```
knowledge-graph/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── projects.py      # プロジェクト CRUD
│   │   │   ├── datasets.py      # データセット CRUD + アップロード
│   │   │   └── ontology.py      # オントロジー全般 (ObjectType, Link, Instance)
│   │   ├── core/
│   │   │   └── security.py      # パスワードハッシュ / JWT (無効)
│   │   ├── models/
│   │   │   ├── project.py
│   │   │   ├── dataset.py
│   │   │   ├── ontology.py      # ObjectType, PropertyType, LinkType, etc.
│   │   │   └── user.py          # (未使用)
│   │   ├── schemas/
│   │   │   ├── project.py
│   │   │   ├── dataset.py
│   │   │   ├── ontology.py
│   │   │   └── user.py          # (未使用)
│   │   ├── config.py            # 設定 (Settings)
│   │   ├── database.py          # DB接続・セッション管理
│   │   └── main.py              # FastAPI アプリケーション
│   └── pyproject.toml
├── frontend/
│   ├── public/
│   │   └── tutorial.html        # チュートリアルページ
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts        # HTTP クライアント
│   │   │   └── types.ts         # 型定義
│   │   ├── components/
│   │   │   ├── Layout.tsx       # メインレイアウト
│   │   │   └── Sidebar.tsx      # サイドバーナビゲーション
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    # ダッシュボード
│   │   │   ├── Projects.tsx     # プロジェクト一覧
│   │   │   ├── ProjectDetail.tsx # プロジェクト詳細
│   │   │   ├── Datasets.tsx     # データセット一覧
│   │   │   ├── OntologyPage.tsx # オントロジー管理
│   │   │   ├── ObjectExplorer.tsx # オブジェクトエクスプローラ
│   │   │   └── GraphView.tsx    # グラフビュー (React Flow)
│   │   └── App.tsx              # ルーティング定義
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── .vscode/
│   └── mcp.json                 # MCP サーバー設定
├── docs/
│   └── SPEC.md                  # 本仕様書
├── mcp_server.py                # MCP サーバー (stdio)
├── seed_tutorial.py             # チュートリアルデータ投入スクリプト
├── test_api.py                  # API テスト
├── Makefile                     # 開発用コマンド
├── docker-compose.yml           # 本番構成
├── .env.example
└── README.md
```

### 2.3 CORS 設定

| 項目 | 値 |
|------|---|
| 許可オリジン | `http://localhost:5173`, `http://localhost:3000` |
| 認証情報 | 許可 |
| メソッド | 全て |
| ヘッダー | 全て |

### 2.4 認証

現在の実装では**認証は無効**。全 API エンドポイントは認証なしでアクセス可能。
User モデル・JWT 関連コードは残存しているが、ルーターは登録されていない。

---

## 3. データモデル

### 3.1 ER 図

```
Project
  │ 1:N
  ├──→ Dataset ──→ DatasetVersion (1:N)
  │
  ├──→ ObjectType ──→ PropertyType (1:N)
  │      │ 1:N
  │      └──→ ObjectInstance
  │             │ M:N            M:N │
  │             ├──→ LinkInstance ←──┘
  │             │      └──→ LinkType
  ├──→ LinkType
  ├──→ ActionType
  └──→ Interface
```

### 3.2 テーブル定義

#### projects

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | Integer | PK, AUTO | ID |
| name | String(255) | NOT NULL | プロジェクト名 |
| slug | String(255) | UNIQUE, NOT NULL | URL 用スラッグ (名前から自動生成) |
| description | Text | DEFAULT "" | 説明 |
| owner_id | Integer | NULLABLE | オーナー (未使用) |
| created_at | DateTime | DEFAULT now() | 作成日時 |
| updated_at | DateTime | DEFAULT now(), ON UPDATE | 更新日時 |

#### datasets

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | Integer | PK, AUTO | ID |
| name | String(255) | NOT NULL | データセット名 |
| description | Text | DEFAULT "" | 説明 |
| project_id | Integer | FK → projects.id, CASCADE | 所属プロジェクト |
| schema_def | JSON | DEFAULT {} | スキーマ定義 |
| storage_path | String(500) | DEFAULT "" | ストレージパス |
| row_count | BigInteger | DEFAULT 0 | 行数 |
| size_bytes | BigInteger | DEFAULT 0 | サイズ (bytes) |
| format | String(50) | DEFAULT "parquet" | フォーマット (parquet/csv/json) |
| created_at | DateTime | DEFAULT now() | 作成日時 |
| updated_at | DateTime | DEFAULT now(), ON UPDATE | 更新日時 |

#### dataset_versions

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | Integer | PK, AUTO | ID |
| dataset_id | Integer | FK → datasets.id, CASCADE | 対象データセット |
| version | Integer | DEFAULT 1 | バージョン番号 |
| storage_path | String(500) | NOT NULL | ストレージパス |
| row_count | BigInteger | DEFAULT 0 | 行数 |
| size_bytes | BigInteger | DEFAULT 0 | サイズ (bytes) |
| created_by | Integer | FK → users.id | 作成者 |
| created_at | DateTime | DEFAULT now() | 作成日時 |

#### object_types

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | Integer | PK, AUTO | ID |
| name | String(255) | NOT NULL | 表示名 |
| api_name | String(255) | UNIQUE, NOT NULL | API 識別名 |
| description | Text | DEFAULT "" | 説明 |
| project_id | Integer | FK → projects.id, CASCADE | 所属プロジェクト |
| primary_key_property | String(255) | NULLABLE | 主キープロパティ名 |
| title_property | String(255) | NULLABLE | タイトルプロパティ名 |
| icon | String(100) | DEFAULT "cube" | アイコン名 |
| color | String(7) | DEFAULT "#6366f1" | テーマカラー (HEX) |
| dataset_id | Integer | FK → datasets.id, NULLABLE | バッキングデータセット |
| created_at | DateTime | DEFAULT now() | 作成日時 |
| updated_at | DateTime | DEFAULT now(), ON UPDATE | 更新日時 |

#### property_types

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | Integer | PK, AUTO | ID |
| object_type_id | Integer | FK → object_types.id, CASCADE | 所属オブジェクトタイプ |
| name | String(255) | NOT NULL | 表示名 |
| api_name | String(255) | NOT NULL | API 識別名 |
| description | Text | DEFAULT "" | 説明 |
| data_type | Enum(DataType) | DEFAULT "string" | データ型 |
| is_required | Boolean | DEFAULT False | 必須フラグ |
| is_indexed | Boolean | DEFAULT False | インデックスフラグ |
| is_array | Boolean | DEFAULT False | 配列フラグ |
| config | JSON | DEFAULT {} | 追加設定 |
| created_at | DateTime | DEFAULT now() | 作成日時 |

**DataType 列挙値:** `string`, `integer`, `float`, `boolean`, `date`, `timestamp`, `array`, `object`, `geoshape`, `geopoint`

#### link_types

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | Integer | PK, AUTO | ID |
| name | String(255) | NOT NULL | 表示名 |
| api_name | String(255) | UNIQUE, NOT NULL | API 識別名 |
| description | Text | DEFAULT "" | 説明 |
| project_id | Integer | FK → projects.id, CASCADE | 所属プロジェクト |
| source_object_type_id | Integer | FK → object_types.id, CASCADE | ソースオブジェクトタイプ |
| target_object_type_id | Integer | FK → object_types.id, CASCADE | ターゲットオブジェクトタイプ |
| cardinality | Enum(Cardinality) | DEFAULT "many_to_many" | カーディナリティ |
| inverse_name | String(255) | NULLABLE | 逆方向の名前 |
| created_at | DateTime | DEFAULT now() | 作成日時 |

**Cardinality 列挙値:** `one_to_one`, `one_to_many`, `many_to_many`

#### action_types

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | Integer | PK, AUTO | ID |
| name | String(255) | NOT NULL | 表示名 |
| api_name | String(255) | UNIQUE, NOT NULL | API 識別名 |
| description | Text | DEFAULT "" | 説明 |
| project_id | Integer | FK → projects.id, CASCADE | 所属プロジェクト |
| object_type_id | Integer | FK → object_types.id, NULLABLE | 対象オブジェクトタイプ |
| parameters | JSON | DEFAULT [] | パラメータ定義 |
| logic | JSON | DEFAULT {} | ロジック定義 |
| created_at | DateTime | DEFAULT now() | 作成日時 |
| updated_at | DateTime | DEFAULT now(), ON UPDATE | 更新日時 |

#### interfaces

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | Integer | PK, AUTO | ID |
| name | String(255) | NOT NULL | 表示名 |
| api_name | String(255) | UNIQUE, NOT NULL | API 識別名 |
| description | Text | DEFAULT "" | 説明 |
| project_id | Integer | FK → projects.id, CASCADE | 所属プロジェクト |
| properties | JSON | DEFAULT [] | プロパティ定義 |
| created_at | DateTime | DEFAULT now() | 作成日時 |

#### object_instances

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | Integer | PK, AUTO | ID |
| object_type_id | Integer | FK → object_types.id, CASCADE | オブジェクトタイプ |
| properties | JSON | DEFAULT {} | プロパティ値 (key-value) |
| created_at | DateTime | DEFAULT now() | 作成日時 |
| updated_at | DateTime | DEFAULT now(), ON UPDATE | 更新日時 |

#### link_instances

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | Integer | PK, AUTO | ID |
| link_type_id | Integer | FK → link_types.id, CASCADE | リンクタイプ |
| source_object_id | Integer | FK → object_instances.id, CASCADE | ソースオブジェクト |
| target_object_id | Integer | FK → object_instances.id, CASCADE | ターゲットオブジェクト |
| properties | JSON | DEFAULT {} | リンクプロパティ |
| created_at | DateTime | DEFAULT now() | 作成日時 |

---

## 4. バックエンド API 仕様

**ベース URL:** `http://localhost:8001/api`

### 4.1 ヘルスチェック

| メソッド | パス | レスポンス |
|----------|------|-----------|
| GET | `/api/health` | `{"status": "ok", "version": "0.1.0"}` |

### 4.2 Projects API

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/projects` | プロジェクト一覧取得 | 200 |
| POST | `/api/projects` | プロジェクト作成 | 201 |
| GET | `/api/projects/{id}` | プロジェクト詳細 | 200 |
| PATCH | `/api/projects/{id}` | プロジェクト更新 | 200 |
| DELETE | `/api/projects/{id}` | プロジェクト削除 | 204 |

### 4.3 Datasets API

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/datasets` | データセット一覧取得 | 200 |
| POST | `/api/datasets` | データセット作成 | 201 |
| GET | `/api/datasets/{id}` | データセット詳細 | 200 |
| PATCH | `/api/datasets/{id}` | データセット更新 | 200 |
| DELETE | `/api/datasets/{id}` | データセット削除 | 204 |
| POST | `/api/datasets/{id}/upload` | ファイルアップロード | 200 |

### 4.4 Ontology API — Object Types

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/ontology/object-types` | オブジェクトタイプ一覧 | 200 |
| POST | `/api/ontology/object-types` | オブジェクトタイプ作成 | 201 |
| GET | `/api/ontology/object-types/{id}` | 詳細取得 | 200 |
| PATCH | `/api/ontology/object-types/{id}` | 更新 | 200 |
| DELETE | `/api/ontology/object-types/{id}` | 削除 | 204 |

### 4.5 Ontology API — Property Types

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/ontology/object-types/{id}/properties` | プロパティ一覧 | 200 |
| POST | `/api/ontology/properties` | プロパティ作成 | 201 |
| DELETE | `/api/ontology/properties/{id}` | プロパティ削除 | 204 |

### 4.6 Ontology API — Object Instances

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/ontology/objects` | インスタンス一覧 | 200 |
| POST | `/api/ontology/objects` | インスタンス作成 | 201 |
| GET | `/api/ontology/objects/{id}` | 詳細取得 | 200 |
| PATCH | `/api/ontology/objects/{id}` | 更新 (properties) | 200 |
| DELETE | `/api/ontology/objects/{id}` | 削除 | 204 |

クエリパラメータ: `object_type_id` (省略可), `skip`, `limit` (max 500)

### 4.7 Ontology API — Link Types

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/ontology/link-types` | リンクタイプ一覧 | 200 |
| POST | `/api/ontology/link-types` | リンクタイプ作成 | 201 |
| DELETE | `/api/ontology/link-types/{id}` | 削除 | 204 |

### 4.8 Ontology API — Link Instances

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/ontology/links` | リンク一覧 (全体) | 200 |
| GET | `/api/ontology/objects/{id}/links` | オブジェクトのリンク一覧 | 200 |
| POST | `/api/ontology/links` | リンク作成 | 201 |
| DELETE | `/api/ontology/links/{id}` | リンク削除 | 204 |

クエリパラメータ: `link_type_id` (省略可), `skip`, `limit` (max 1000)

### 4.9 Ontology API — Action Types

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/ontology/action-types` | アクションタイプ一覧 | 200 |
| POST | `/api/ontology/action-types` | アクションタイプ作成 | 201 |

### 4.10 エラーレスポンス

| HTTP ステータス | 説明 |
|----------------|------|
| 400 | リクエスト不正 |
| 404 | リソースが見つからない |
| 422 | バリデーションエラー (Pydantic) |
| 500 | サーバー内部エラー |

---

## 5. フロントエンド仕様

### 5.1 ルーティング

| パス | ページ | 説明 |
|------|--------|------|
| `/` | Dashboard | 統計カード + 最新プロジェクト/オブジェクトタイプ |
| `/projects` | Projects | プロジェクト一覧・作成 |
| `/projects/:id` | ProjectDetail | プロジェクト詳細 (データセット/タイプ) |
| `/datasets` | Datasets | データセット一覧・作成 |
| `/ontology` | OntologyPage | オブジェクトタイプ/リンクタイプ管理 |
| `/ontology/explorer/:objectTypeId` | ObjectExplorer | インスタンス CRUD + リンク表示 |
| `/graph` | GraphView | グラフビュー (React Flow) |
| `*` | — | `/` にリダイレクト |

### 5.2 ページ詳細

#### Dashboard

3 つの統計カード (Projects, Datasets, Object Types) と 2 つのウィジェット (Recent Projects, Recent Object Types)。

#### OntologyPage

2 タブ構成: Object Types (グリッド表示、カラーバッジ、Explore リンク) / Link Types (リスト表示)。

#### ObjectExplorer

3 カラム: 左=プロパティ一覧、中央=オブジェクト一覧、右=選択オブジェクト詳細+リンク。

#### GraphView

React Flow を使った対話型グラフ可視化。

| 機能 | 説明 |
|------|------|
| カスタムノード | ObjectType の color をベースにした丸角ノード。先頭文字バッジ + 名前表示 |
| 列レイアウト | ObjectType ごとに列を分けて自動配置 |
| エッジカラーリング | LinkType ごとに 8 色パレットで自動着色 |
| 色ブレンド | 同一 source-target 間に複数 LinkType がある場合、RGB 平均でブレンド |
| ノードフォーカス | ノード選択時、接続エッジを太線+アニメーション。非接続エッジを半透明化 |
| ノードタイプフィルタ | ObjectType ごとに表示/非表示を切り替え |
| リンクタイプフィルタ | LinkType ごとに表示/非表示を切り替え |
| サイドパネル | ノードやエッジ選択時に詳細情報を表示 |
| リンク作成モーダル | ノード間ドラッグでリンク作成ダイアログを表示 |
| ミニマップ/コントロール | ズーム/フィット/ロックボタン |

**エッジカラーパレット (EDGE_COLORS):**
`#f97316` (orange), `#06b6d4` (cyan), `#8b5cf6` (violet), `#ec4899` (pink), `#14b8a6` (teal), `#f59e0b` (amber), `#6366f1` (indigo), `#ef4444` (red)

### 5.3 共通コンポーネント

#### Sidebar

- 背景色: `bg-brand-950` (indigo 系)
- ロゴ: Hexagon アイコン + "KG Hub"
- ナビ項目: Dashboard, Projects, Datasets, Ontology, Graph
- 下部: Tutorial リンク (BookOpen アイコン)

---

## 6. MCP サーバー

### 6.1 概要

GitHub Copilot 等の AI エージェントから KG Hub のナレッジグラフを操作するための
MCP (Model Context Protocol) サーバー。stdio トランスポートで動作し、
バックエンド API (`http://127.0.0.1:8001/api`) を httpx で呼び出す。

**ファイル:** `mcp_server.py`
**設定:** `.vscode/mcp.json`
**依存:** `mcp[cli]`, `httpx`

### 6.2 VS Code 設定

`.vscode/mcp.json`:

```json
{
  "servers": {
    "kghub": {
      "type": "stdio",
      "command": "${workspaceFolder}/.venv/Scripts/python.exe",
      "args": ["${workspaceFolder}/mcp_server.py"]
    }
  }
}
```

### 6.3 ツール一覧 (18 tools)

#### Object Types (5)

| ツール | 説明 |
|--------|------|
| `list_object_types` | ObjectType 一覧取得 (`project_id?`) |
| `get_object_type` | ObjectType 詳細取得 |
| `create_object_type` | ObjectType 新規作成 |
| `update_object_type` | ObjectType 更新 |
| `delete_object_type` | ObjectType 削除 |

#### Property Types (2)

| ツール | 説明 |
|--------|------|
| `list_properties` | PropertyType 一覧取得 |
| `create_property` | PropertyType 新規作成 |

#### Object Instances (5)

| ツール | 説明 |
|--------|------|
| `list_objects` | ObjectInstance 一覧取得 (`object_type_id?`, `limit?`) |
| `get_object` | ObjectInstance 詳細取得 |
| `create_object` | ObjectInstance 新規作成 |
| `update_object` | ObjectInstance プロパティ更新 |
| `delete_object` | ObjectInstance 削除 |

#### Link Types (2)

| ツール | 説明 |
|--------|------|
| `list_link_types` | LinkType 一覧取得 |
| `create_link_type` | LinkType 新規作成 |

#### Link Instances (3)

| ツール | 説明 |
|--------|------|
| `list_links` | LinkInstance 一覧取得 (`link_type_id?`) |
| `create_link` | LinkInstance 新規作成 |
| `delete_link` | LinkInstance 削除 |

#### Graph (1)

| ツール | 説明 |
|--------|------|
| `search_graph` | グラフ全体サマリー (全 ObjectType/LinkType/ノード数/リンク数) |

### 6.4 利用例

```
User: ナレッジグラフの全体像を教えて
→ search_graph()

User: Team の一覧を見せて
→ list_objects(object_type_id=1)

User: 新しい App ノードを追加して
→ create_object(object_type_id=3, properties={...})

User: App → LogPipeline のログ分析パスを教えて
→ list_links(link_type_id=6) で emits_log リンクを取得
```

### 6.5 前提条件

- バックエンド (`make start`) が `http://127.0.0.1:8001` で起動中であること
- `.venv` に `mcp[cli]` がインストール済みであること

---

## 7. インフラストラクチャ

### 7.1 ローカル開発

```bash
make start        # バックエンド (port 8001) + フロントエンド (port 5173)
make stop
make restart
make test         # pytest test_api.py
make health       # GET /api/health
```

### 7.2 チュートリアルデータ投入

```bash
python seed_tutorial.py
```

バックエンド起動状態で実行。以下のデータを作成:

| リソース | 件数 | 内容 |
|----------|------|------|
| Project | 1 | "Infra Knowledge" |
| ObjectType | 6 | Team, ServerGroup, App, DBTable, LogPipeline, TrinoTable |
| PropertyType | 44 | 各 ObjectType に 4〜10 個 |
| ObjectInstance | 23 | 3 + 4 + 4 + 5 + 3 + 4 |
| LinkType | 7 | maintains, develops, deployed_on, calls, reads_table, emits_log, produces |
| LinkInstance | 40 | 6 + 4 + 6 + 3 + 10 + 6 + 5 |

**ObjectType カラー:**

| ObjectType | Color | Instances |
|------------|-------|-----------|
| Team | `#8b5cf6` (violet) | 3 |
| ServerGroup | `#f59e0b` (amber) | 4 |
| App | `#10b981` (emerald) | 4 |
| DBTable | `#ef4444` (red) | 5 |
| LogPipeline | `#06b6d4` (cyan) | 3 |
| TrinoTable | `#ec4899` (pink) | 4 |

**LinkType:**

| LinkType | Source → Target | Links |
|----------|----------------|-------|
| maintains | Team → ServerGroup | 6 |
| develops | Team → App | 4 |
| deployed_on | App → ServerGroup | 6 |
| calls | App → App | 3 |
| reads_table | App → DBTable | 10 |
| emits_log | App → LogPipeline | 6 |
| produces | LogPipeline → TrinoTable | 5 |

**ログ分析パス:** `App → emits_log → LogPipeline → produces → TrinoTable`

---

## 8. チュートリアルシナリオ

### 8.1 解決する課題

| 課題 | KG Hub による解決 |
|------|-------------------|
| サーバー構成の把握 | ServerGroup ノードで構成を可視化 |
| 担当チームの特定 | `maintains` / `develops` リンクで辿る |
| アプリ間依存関係 | `calls` / `deployed_on` リンクで明文化 |
| DB 参照関係 | `reads_table` リンクで可視化 |
| ログ分析パス | `emits_log` → `produces` パスで自動探索 |
| AI/MCP 連携 | MCP サーバーで Copilot から直接操作 |

---

## 9. ロードマップ

### Phase 1 — 基盤構築 ✅ 完了

- [x] プロジェクト CRUD
- [x] データセット CRUD + ファイルアップロード
- [x] オントロジー (ObjectType / PropertyType / LinkType / ActionType)
- [x] オブジェクトインスタンス CRUD
- [x] リンクインスタンス CRUD
- [x] オブジェクトエクスプローラ
- [x] チュートリアル

### Phase 2 — 可視化 & AI 連携 🔧 実装中

- [x] グラフビュー (React Flow)
- [x] ノードタイプ/リンクタイプフィルタ
- [x] エッジカラーリング (8 色パレット)
- [x] 色ブレンド (同一 source-target 間)
- [x] ノードフォーカスハイライト
- [x] MCP サーバー (18 ツール)
- [x] チュートリアルデータ拡充 (6 ObjectType / 7 LinkType / 40 links)
- [ ] MCP 経由での Trino クエリ実行
- [ ] MCP 経由での CMDB 参照

### Phase 3 — 高度な機能

- [ ] MinIO 連携によるファイルアップロード
- [ ] インターフェース機能
- [ ] 全文検索
- [ ] Workshop (アプリケーションビルダー)
- [ ] Quiver (分析ダッシュボード)
