# Knowledge Graph Hub (KG Hub) — 仕様書

> **バージョン:** 0.1.0  
> **最終更新:** 2026-04-04  
> **ステータス:** Phase 1 実装済み

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [システムアーキテクチャ](#2-システムアーキテクチャ)
3. [データモデル](#3-データモデル)
4. [バックエンド API 仕様](#4-バックエンド-api-仕様)
5. [フロントエンド仕様](#5-フロントエンド仕様)
6. [インフラストラクチャ](#6-インフラストラクチャ)
7. [チュートリアルシナリオ](#7-チュートリアルシナリオ)
8. [ロードマップ](#8-ロードマップ)

---

## 1. プロジェクト概要

### 1.1 目的

Knowledge Graph Hub (KG Hub) は、オントロジーベースのナレッジグラフ＆データプラットフォームである。
組織の暗黙知（サーバー構成、チーム体制、運用手順など）を構造化されたグラフとして管理し、
誰でも検索・参照可能な状態にすることを目的とする。

### 1.2 主な機能

| 機能 | 説明 |
|------|------|
| **プロジェクト管理** | ナレッジグラフを論理的に分離するプロジェクト単位の管理 |
| **オントロジー定義** | オブジェクトタイプ、プロパティタイプ、リンクタイプによるスキーマ定義 |
| **オブジェクトエクスプローラ** | オブジェクトインスタンスの CRUD、リンク関係の可視化 |
| **データセット管理** | CSV/JSON/Parquet 形式のデータセット管理 |
| **パイプライン** | データ変換パイプラインの定義・実行 |
| **チュートリアル** | サーバー管理シナリオによる対話型学習ガイド |

### 1.3 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | React 18.3 / TypeScript 5.5 / Vite 5.4 / TailwindCSS 3.4 |
| バックエンド | Python 3.14 / FastAPI / SQLAlchemy 2.0 (async) |
| データベース | SQLite (aiosqlite) — 本番は PostgreSQL 対応 |
| 状態管理 | TanStack React Query v5 |
| アイコン | Lucide React |
| ルーティング | React Router v6 |

---

## 2. システムアーキテクチャ

### 2.1 全体構成

```
┌──────────────────────────────────────────────────────────┐
│                     ブラウザ                              │
│  React SPA (localhost:5173)                              │
│  ┌─────────┬──────────┬──────────┬───────────┬────────┐  │
│  │Dashboard│Projects  │Ontology  │Datasets   │Pipeline│  │
│  └────┬────┴────┬─────┴────┬─────┴─────┬─────┴───┬────┘  │
│       └─────────┴──────────┴───────────┴─────────┘       │
│                         │ HTTP (fetch)                    │
└─────────────────────────┼────────────────────────────────┘
                          │  /api/*
┌─────────────────────────┼────────────────────────────────┐
│               FastAPI (localhost:8001)                    │
│  ┌──────────┬───────────┬──────────┬──────────────────┐  │
│  │ Projects │ Datasets  │ Ontology │ Pipelines        │  │
│  │ Router   │ Router    │ Router   │ Router           │  │
│  └────┬─────┴─────┬─────┴────┬─────┴──────┬──────────┘  │
│       └───────────┴──────────┴────────────┘              │
│                         │ SQLAlchemy (async)              │
│  ┌──────────────────────┴──────────────────────────────┐ │
│  │              SQLite (kghub.db)                       │ │
│  └─────────────────────────────────────────────────────┘ │
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
│   │   │   ├── ontology.py      # オントロジー全般
│   │   │   └── pipelines.py     # パイプライン CRUD + 実行
│   │   ├── core/
│   │   │   └── security.py      # パスワードハッシュ / JWT (無効)
│   │   ├── models/
│   │   │   ├── project.py
│   │   │   ├── dataset.py
│   │   │   ├── ontology.py      # ObjectType, PropertyType, LinkType, etc.
│   │   │   ├── pipeline.py
│   │   │   └── user.py          # (未使用)
│   │   ├── schemas/
│   │   │   ├── project.py
│   │   │   ├── dataset.py
│   │   │   ├── ontology.py
│   │   │   ├── pipeline.py
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
│   │   │   ├── Pipelines.tsx    # パイプライン一覧
│   │   │   └── Login.tsx        # (未使用)
│   │   └── App.tsx              # ルーティング定義
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── docs/
│   └── SPEC.md                  # 本仕様書
├── seed_tutorial.py             # チュートリアルデータ投入スクリプト
├── test_api.py                  # API テスト (16件)
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
Project ─────────────────────────────────────────────┐
  │ 1:N                                              │ 1:N
  ├──→ Dataset                                       ├──→ Pipeline
  │      │ 1:N                                       │      │ 1:N
  │      └──→ DatasetVersion                         │      ├──→ PipelineStep
  │                                                  │      └──→ PipelineRun
  ├──→ ObjectType ──→ PropertyType (1:N)
  │      │ 1:N
  │      └──→ ObjectInstance
  │             │ 1:N             1:N │
  │             ├──→ LinkInstance ←───┘
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

#### pipelines

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | Integer | PK, AUTO | ID |
| name | String(255) | NOT NULL | パイプライン名 |
| description | Text | DEFAULT "" | 説明 |
| project_id | Integer | FK → projects.id, CASCADE | 所属プロジェクト |
| status | Enum(PipelineStatus) | DEFAULT "draft" | 状態 |
| config | JSON | DEFAULT {} | 設定 |
| schedule | JSON | DEFAULT {} | スケジュール定義 |
| input_dataset_ids | JSON | DEFAULT [] | 入力データセット ID 一覧 |
| output_dataset_id | Integer | FK → datasets.id, NULLABLE | 出力データセット |
| created_by | Integer | NULLABLE | 作成者 |
| created_at | DateTime | DEFAULT now() | 作成日時 |
| updated_at | DateTime | DEFAULT now(), ON UPDATE | 更新日時 |

**PipelineStatus 列挙値:** `draft`, `active`, `paused`, `archived`

#### pipeline_steps

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | Integer | PK, AUTO | ID |
| pipeline_id | Integer | FK → pipelines.id, CASCADE | 所属パイプライン |
| name | String(255) | NOT NULL | ステップ名 |
| step_order | Integer | DEFAULT 0 | 実行順序 |
| step_type | String(100) | NOT NULL | 種別 (filter/join/aggregate/transform) |
| config | JSON | DEFAULT {} | 設定 |
| created_at | DateTime | DEFAULT now() | 作成日時 |

#### pipeline_runs

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | Integer | PK, AUTO | ID |
| pipeline_id | Integer | FK → pipelines.id, CASCADE | 対象パイプライン |
| status | Enum(RunStatus) | DEFAULT "pending" | 実行状態 |
| started_at | DateTime | NULLABLE | 開始日時 |
| completed_at | DateTime | NULLABLE | 完了日時 |
| error_message | Text | NULLABLE | エラーメッセージ |
| metrics | JSON | DEFAULT {} | 実行メトリクス |
| triggered_by | Integer | NULLABLE | 実行者 |

**RunStatus 列挙値:** `pending`, `running`, `succeeded`, `failed`, `cancelled`

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

**クエリパラメータ (GET 一覧):**

| パラメータ | 型 | デフォルト | 説明 |
|------------|-----|-----------|------|
| skip | int | 0 | オフセット |
| limit | int | 50 | 取得件数 (1-200) |

**リクエストボディ (POST):**

```json
{
  "name": "Infra Knowledge",    // 必須
  "description": "サーバー管理"  // 省略可
}
```

**レスポンス:**

```json
{
  "id": 1,
  "name": "Infra Knowledge",
  "slug": "infra-knowledge",
  "description": "サーバー管理",
  "created_at": "2026-04-04T10:00:00Z",
  "updated_at": "2026-04-04T10:00:00Z"
}
```

### 4.3 Datasets API

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/datasets` | データセット一覧取得 | 200 |
| POST | `/api/datasets` | データセット作成 | 201 |
| GET | `/api/datasets/{id}` | データセット詳細 | 200 |
| PATCH | `/api/datasets/{id}` | データセット更新 | 200 |
| DELETE | `/api/datasets/{id}` | データセット削除 | 204 |
| POST | `/api/datasets/{id}/upload` | ファイルアップロード | 200 |

**クエリパラメータ (GET 一覧):**

| パラメータ | 型 | デフォルト | 説明 |
|------------|-----|-----------|------|
| project_id | int | null | プロジェクトでフィルタ |
| skip | int | 0 | オフセット |
| limit | int | 50 | 取得件数 |

**リクエストボディ (POST):**

```json
{
  "name": "server-list",         // 必須
  "project_id": 1,              // 必須
  "description": "サーバー一覧",  // 省略可
  "schema_def": {},              // 省略可
  "format": "csv"                // 省略可 (parquet/csv/json)
}
```

### 4.4 Ontology API — Object Types

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/ontology/object-types` | オブジェクトタイプ一覧 | 200 |
| POST | `/api/ontology/object-types` | オブジェクトタイプ作成 | 201 |
| GET | `/api/ontology/object-types/{id}` | 詳細取得 | 200 |
| PATCH | `/api/ontology/object-types/{id}` | 更新 | 200 |
| DELETE | `/api/ontology/object-types/{id}` | 削除 | 204 |

**リクエストボディ (POST):**

```json
{
  "name": "Server",           // 必須
  "api_name": "server",       // 必須 (ユニーク)
  "project_id": 1,            // 必須
  "description": "物理/仮想サーバー",
  "icon": "cube",             // デフォルト: "cube"
  "color": "#6366f1",         // デフォルト: "#6366f1"
  "primary_key_property": "hostname",
  "title_property": "hostname"
}
```

### 4.5 Ontology API — Property Types

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/ontology/object-types/{id}/properties` | プロパティ一覧 | 200 |
| POST | `/api/ontology/properties` | プロパティ作成 | 201 |
| DELETE | `/api/ontology/properties/{id}` | プロパティ削除 | 204 |

**リクエストボディ (POST):**

```json
{
  "object_type_id": 1,      // 必須
  "name": "Hostname",       // 必須
  "api_name": "hostname",   // 必須
  "data_type": "string",    // デフォルト: "string"
  "is_required": true,
  "is_indexed": true,
  "is_array": false,
  "description": "ホスト名",
  "config": {}
}
```

### 4.6 Ontology API — Object Instances

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/ontology/objects` | インスタンス一覧 | 200 |
| POST | `/api/ontology/objects` | インスタンス作成 | 201 |
| GET | `/api/ontology/objects/{id}` | 詳細取得 | 200 |
| PATCH | `/api/ontology/objects/{id}` | 更新 | 200 |
| DELETE | `/api/ontology/objects/{id}` | 削除 | 204 |

**クエリパラメータ (GET 一覧):**

| パラメータ | 型 | 必須 | 説明 |
|------------|-----|------|------|
| object_type_id | int | **必須** | オブジェクトタイプ ID |
| skip | int | | オフセット |
| limit | int | | 取得件数 |

**リクエストボディ (POST):**

```json
{
  "object_type_id": 1,
  "properties": {
    "hostname": "web-prod-01",
    "ip_address": "10.1.1.11",
    "status": "SIN",
    "env": "production",
    "log_path": "/var/log/nginx/access.log",
    "access_method": "ssh web-prod-01.internal",
    "purpose": "メイン Web サーバー (Nginx + Node.js)"
  }
}
```

### 4.7 Ontology API — Link Types

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/ontology/link-types` | リンクタイプ一覧 | 200 |
| POST | `/api/ontology/link-types` | リンクタイプ作成 | 201 |
| DELETE | `/api/ontology/link-types/{id}` | 削除 | 204 |

**リクエストボディ (POST):**

```json
{
  "name": "owns",
  "api_name": "owns",
  "project_id": 1,
  "source_object_type_id": 2,    // Team
  "target_object_type_id": 1,    // Server
  "cardinality": "one_to_many",
  "description": "チームがサーバーを管理する関係",
  "inverse_name": "owned_by"
}
```

### 4.8 Ontology API — Link Instances

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/ontology/objects/{id}/links` | オブジェクトのリンク一覧 | 200 |
| POST | `/api/ontology/links` | リンク作成 | 201 |
| DELETE | `/api/ontology/links/{id}` | リンク削除 | 204 |

**リクエストボディ (POST):**

```json
{
  "link_type_id": 1,
  "source_object_id": 6,    // 開発チーム Alpha
  "target_object_id": 1,    // web-prod-01
  "properties": {}
}
```

### 4.9 Pipelines API

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/pipelines` | パイプライン一覧 | 200 |
| POST | `/api/pipelines` | パイプライン作成 | 201 |
| GET | `/api/pipelines/{id}` | 詳細取得 | 200 |
| PATCH | `/api/pipelines/{id}` | 更新 | 200 |
| DELETE | `/api/pipelines/{id}` | 削除 | 204 |
| GET | `/api/pipelines/{id}/steps` | ステップ一覧 | 200 |
| POST | `/api/pipelines/{id}/steps` | ステップ追加 | 201 |
| GET | `/api/pipelines/{id}/runs` | 実行履歴一覧 | 200 |
| POST | `/api/pipelines/{id}/run` | パイプライン実行 | 201 |

**リクエストボディ (POST パイプライン作成):**

```json
{
  "name": "Server Sync Pipeline",
  "project_id": 1,
  "description": "CMDB からサーバー情報を同期",
  "config": {},
  "schedule": {},
  "input_dataset_ids": [],
  "output_dataset_id": null
}
```

### 4.10 Action Types API

| メソッド | パス | 説明 | ステータス |
|----------|------|------|-----------|
| GET | `/api/ontology/action-types` | アクションタイプ一覧 | 200 |
| POST | `/api/ontology/action-types` | アクションタイプ作成 | 201 |

### 4.11 エラーレスポンス

全 API 共通のエラー形式:

```json
{
  "detail": "Not Found"
}
```

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
| `/projects/:id` | ProjectDetail | プロジェクト詳細 (データセット/タイプ/パイプライン) |
| `/datasets` | Datasets | データセット一覧・作成 |
| `/ontology` | OntologyPage | オブジェクトタイプ/リンクタイプ管理 |
| `/ontology/explorer/:objectTypeId` | ObjectExplorer | インスタンス CRUD + リンク表示 |
| `/pipelines` | Pipelines | パイプライン一覧・作成・実行 |
| `*` | — | `/` にリダイレクト |

### 5.2 ページ詳細

#### Dashboard (`/`)

4 つの統計カードと 2 つのウィジェットで構成。

**統計カード:**

| カード | API | 表示 | リンク先 |
|--------|-----|------|---------|
| Projects | GET /api/projects | 件数 | /projects |
| Datasets | GET /api/datasets | 件数 | /datasets |
| Object Types | GET /api/ontology/object-types | 件数 | /ontology |
| Pipelines | GET /api/pipelines | 件数 | /pipelines |

**ウィジェット:**
- **Recent Projects** — 最新 5 件のプロジェクト (名前・説明・作成日)
- **Recent Object Types** — 最新 5 件のオブジェクトタイプ (カラーバッジ・名前)

#### OntologyPage (`/ontology`)

2 つのタブで構成:

**Object Types タブ:**
- オブジェクトタイプをグリッド表示 (lg:3列, md:2列, sm:1列)
- 各カード: カラーバッジ (先頭文字)、名前、api_name
- ホバーで削除ボタン表示
- 「Explore Objects →」リンクでオブジェクトエクスプローラへ遷移

**Link Types タブ:**
- リンクタイプをリスト表示
- Source Type → (cardinality) → Target Type 形式

#### ObjectExplorer (`/ontology/explorer/:objectTypeId`)

3 カラムレイアウト:

| 左パネル | 中央パネル | 右パネル |
|----------|------------|----------|
| プロパティ一覧 | オブジェクト一覧 | 選択オブジェクト詳細 |
| + プロパティ追加 | + インスタンス作成 | プロパティ値表示 |
| データ型タグ表示 | タイトルプロパティで表示 | 関連リンク一覧 |
| 必須バッジ | | 削除ボタン |

### 5.3 共通コンポーネント

#### Layout

```
┌──────────────────────────────────────┐
│ Sidebar (w-64)  │  Main Content      │
│                 │  (flex-1, p-8)     │
│  KG Hub ロゴ    │                    │
│  Dashboard      │  [children]        │
│  Projects       │                    │
│  Datasets       │                    │
│  Ontology       │                    │
│  Pipelines      │                    │
│                 │                    │
│  📖 Tutorial    │                    │
└──────────────────────────────────────┘
```

#### Sidebar

- 背景色: `bg-brand-950` (indigo 系)
- ロゴ: Hexagon アイコン + "KG Hub"
- ナビゲーション: NavLink (React Router) でアクティブ状態を可視化
- 下部: チュートリアルリンク (BookOpen アイコン)

### 5.4 API クライアント

`src/api/client.ts`:

```typescript
const API_BASE = '/api';

export const api = {
  get:      <T>(path) => request<T>(path),
  post:     <T>(path, body?) => request<T>(path, { method: 'POST', body }),
  patch:    <T>(path, body) => request<T>(path, { method: 'PATCH', body }),
  delete:   (path) => request<void>(path, { method: 'DELETE' }),
  postForm: <T>(path, body: URLSearchParams) => request<T>(path, { ... }),
};
```

- 204 レスポンスは `undefined` を返却
- エラー時は `response.statusText` で throw
- JSON Content-Type 自動付与

### 5.5 Tailwind カスタムカラー

`brand` カラーパレット (indigo 系):

| トークン | HEX |
|----------|-----|
| brand-50 | #eef2ff |
| brand-100 | #e0e7ff |
| brand-200 | #c7d2fe |
| brand-300 | #a5b4fc |
| brand-400 | #818cf8 |
| brand-500 | #6366f1 |
| brand-600 | #4f46e5 |
| brand-700 | #4338ca |
| brand-800 | #3730a3 |
| brand-900 | #312e81 |
| brand-950 | #1e1b4b |

---

## 6. インフラストラクチャ

### 6.1 ローカル開発 (現行)

```bash
# 開始
make start        # バックエンド (port 8001) + フロントエンド (port 5173)

# 停止
make stop

# 再起動
make restart

# テスト実行
make test         # pytest test_api.py (16 テスト)

# ヘルスチェック
make health       # GET /api/health
```

**プロセス管理:**
- バックエンド PID → `.backend.pid`
- フロントエンド PID → `.frontend.pid`
- PowerShell の `Start-Process` で背景起動

### 6.2 Docker Compose (本番構成)

| サービス | イメージ | ポート | 用途 |
|----------|---------|--------|------|
| postgres | postgres:16-alpine | 5432 | メインDB |
| redis | redis:7-alpine | 6379 | キャッシュ |
| minio | minio/minio:latest | 9000, 9001 | オブジェクトストレージ |
| backend | ./backend/Dockerfile | 8000 | FastAPI |
| frontend | ./frontend/Dockerfile | 5173 | Vite Dev Server |

### 6.3 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| DATABASE_URL | sqlite+aiosqlite:///./kghub.db | DB接続文字列 |
| REDIS_URL | redis://localhost:6379/0 | Redis 接続 |
| MINIO_ENDPOINT | localhost:9000 | MinIO エンドポイント |
| MINIO_ACCESS_KEY | minioadmin | MinIO アクセスキー |
| MINIO_SECRET_KEY | minioadmin123 | MinIO シークレット |
| MINIO_BUCKET | kghub-datasets | MinIO バケット名 |
| SECRET_KEY | (要変更) | JWT シークレット |
| CORS_ORIGINS | localhost:5173,3000 | CORS 許可オリジン |

### 6.4 チュートリアルデータ投入

```bash
python seed_tutorial.py
```

バックエンド起動状態 (`localhost:8001`) で実行。以下のデータを API 経由で作成:

| リソース | 件数 | 内容 |
|----------|------|------|
| Project | 1 | "Infra Knowledge" |
| ObjectType | 2 | Server, Team |
| PropertyType | 11 | hostname, ip_address, status, env, log_path, access_method, purpose, name, slack_channel, oncall_rotation, lead |
| ObjectInstance (Server) | 5 | web-prod-01, api-prod-01, api-prod-02, batch-prod-01, web-stg-01 |
| ObjectInstance (Team) | 3 | 開発チーム Alpha, 開発チーム Bravo, インフラチーム |
| LinkType | 1 | "owns" (Team → Server, one_to_many) |
| LinkInstance | 5 | 各チームとサーバーの所有関係 |

---

## 7. チュートリアルシナリオ

### 7.1 概要

**テーマ:** サーバー管理ナレッジグラフ  
**所要時間:** 約 40 分  
**対象:** KG Hub を初めて使うユーザー

### 7.2 解決する課題

| 課題 | 現状 | KG Hub による解決 |
|------|------|-------------------|
| サーバーの SIN/SOUT 状態 | チームの記憶に依存 | Server オブジェクトの `status` プロパティ |
| 担当チームの特定 | Slack で都度確認 | `owns` リンクで Team → Server を辿る |
| ログの場所 | Wiki が古い | `log_path` プロパティに正確な値 |
| SSH アクセス方法 | 暗黙知 | `access_method` プロパティで明文化 |

### 7.3 チュートリアルステップ

| Step | 内容 | 操作 |
|------|------|------|
| 1 | 課題の理解 | 読み物 |
| 2 | オントロジー設計 | Server (7 props) + Team (4 props) の設計 |
| 3 | プロジェクト作成 | "Infra Knowledge" プロジェクトを作成 |
| 4 | Server タイプ作成 | ObjectType + 7 PropertyType を定義 |
| 5 | Server インスタンス作成 | 5 台のサーバーデータを登録 |
| 6 | Team タイプ作成 | ObjectType + 4 PropertyType を定義 |
| 7 | Team インスタンス作成 | 3 チームのデータを登録 |
| 8 | リンクタイプ作成 | "owns" (Team → Server) を定義 |
| 9 | リンク作成 | 5 つの所有関係を登録 |
| 10 | エクスプローラで確認 | グラフ探索の体験 |
| 11 | MCP × Copilot 連携ビジョン | 将来構想の紹介 |
| 12 | まとめ | Before/After 比較 |

### 7.4 サンプルデータ

**Server インスタンス:**

| hostname | ip_address | status | env | purpose |
|----------|-----------|--------|-----|---------|
| web-prod-01 | 10.1.1.11 | SIN | production | Nginx + Node.js |
| api-prod-01 | 10.1.1.21 | SIN | production | FastAPI |
| api-prod-02 | 10.1.1.22 | SOUT | production | メンテナンス中 |
| batch-prod-01 | 10.1.2.10 | SIN | production | バッチ処理 |
| web-stg-01 | 10.2.1.11 | SIN | staging | ステージング |

**Team インスタンス:**

| name | slack_channel | oncall_rotation | lead |
|------|--------------|----------------|------|
| 開発チーム Alpha | #team-alpha | 週次ローテ | 田中太郎 |
| 開発チーム Bravo | #team-bravo | 日次ローテ | 佐藤花子 |
| インフラチーム | #infra | 24/7 シフト | 鈴木一郎 |

**所有関係:**

| Team | Server |
|------|--------|
| 開発チーム Alpha | web-prod-01 |
| 開発チーム Alpha | web-stg-01 |
| 開発チーム Bravo | api-prod-01 |
| 開発チーム Bravo | api-prod-02 |
| インフラチーム | batch-prod-01 |

---

## 8. ロードマップ

### Phase 1 — 基盤構築 ✅ 完了

- [x] プロジェクト CRUD
- [x] データセット CRUD + ファイルアップロード
- [x] オントロジー (ObjectType / PropertyType / LinkType / ActionType)
- [x] オブジェクトインスタンス CRUD
- [x] リンクインスタンス CRUD
- [x] オブジェクトエクスプローラ
- [x] パイプライン CRUD + スケジュール + 実行
- [x] チュートリアル (サーバー管理シナリオ)

### Phase 2 — 機能強化

- [ ] MinIO 連携によるファイルアップロード実装
- [ ] パイプライン実行エンジン (バックグラウンドワーカー)
- [ ] インターフェース機能
- [ ] スキーマ自動検出
- [ ] グラフビジュアライゼーション
- [ ] 全文検索

### Phase 3 — 高度な機能

- [ ] ビジュアルパイプラインビルダー
- [ ] Workshop (アプリケーションビルダー)
- [ ] Quiver (分析ダッシュボード)
- [ ] ML モデル統合
- [ ] AI Agent フレームワーク (MCP 連携)
