"""Seed the database with tutorial data (Server Management Knowledge Graph).

Creates:
  - 1 Project: Infra Knowledge
  - 6 ObjectTypes: Team, ServerGroup, App, DBTable, LogPipeline, TrinoTable
  - 3 Team, 4 ServerGroup, 4 App, 5 DBTable, 3 LogPipeline, 4 TrinoTable instances
  - 7 LinkTypes: maintains, develops, deployed_on, calls, reads_table, emits_log, produces
  - 39 LinkInstances

Note: 個別サーバーはグラフに含めず、ServerGroup の外部DB参照
(source_dsn / source_table / mcp_hint) を使って MCP 経由で探索する設計。
ログ分析は App → emits_log → LogPipeline → produces → TrinoTable のパスで。
"""
import os
import urllib.request
import json
import sys

BASE = os.environ.get("API_BASE", "http://127.0.0.1:8000/api")


def post(path: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def main():
    # ═══════════════════════════════════════════
    # 1. Project
    # ═══════════════════════════════════════════
    print("=== Creating Project ===")
    project = post("/projects", {
        "name": "Infra Knowledge",
        "description": "サーバー管理 × 組織構造 ナレッジグラフ",
    })
    pid = project["id"]
    print(f"  Project: id={pid}")

    # ═══════════════════════════════════════════
    # 2. Team ObjectType + Properties
    # ═══════════════════════════════════════════
    print("=== Creating Team Object Type ===")
    team_type = post("/ontology/object-types", {
        "name": "Team",
        "api_name": "team",
        "project_id": pid,
        "description": "開発/インフラチームの情報",
        "color": "#8b5cf6",
        "title_property": "name",
    })
    t_tid = team_type["id"]
    print(f"  Team ObjectType: id={t_tid}")

    print("=== Creating Team Properties ===")
    for name, api_name in [
        ("Team Name", "name"),
        ("Slack Channel", "slack_channel"),
        ("Oncall Rotation", "oncall_rotation"),
        ("Lead", "lead"),
    ]:
        p = post("/ontology/properties", {
            "object_type_id": t_tid, "name": name,
            "api_name": api_name, "data_type": "string",
        })
        print(f"  Property: {name} (id={p['id']})")

    # ═══════════════════════════════════════════
    # 3. Team Instances
    # ═══════════════════════════════════════════
    print("=== Creating Team Instances ===")
    teams_data = [
        {"name": "開発チーム Alpha", "slack_channel": "#dev-alpha",
         "oncall_rotation": "毎週月曜ローテ: 田中→佐藤→鈴木", "lead": "田中 太郎"},
        {"name": "開発チーム Bravo", "slack_channel": "#dev-bravo",
         "oncall_rotation": "毎週月曜ローテ: 山田→高橋→伊藤", "lead": "山田 花子"},
        {"name": "インフラチーム", "slack_channel": "#infra-ops",
         "oncall_rotation": "PagerDuty: infra-oncall エスカレーション", "lead": "中村 健一"},
    ]
    team_ids = []
    for t in teams_data:
        obj = post("/ontology/objects", {"object_type_id": t_tid, "properties": t})
        team_ids.append(obj["id"])
        print(f"  Team: {t['name']} (id={obj['id']})")

    alpha_id, bravo_id, infra_id = team_ids

    # ═══════════════════════════════════════════
    # 4. ServerGroup ObjectType + Properties
    # ═══════════════════════════════════════════
    print("=== Creating ServerGroup Object Type ===")
    sg_type = post("/ontology/object-types", {
        "name": "ServerGroup",
        "api_name": "server_group",
        "project_id": pid,
        "description": "サーバー群の論理グループ。個別サーバー情報は外部DB (CMDB) を MCP 経由で参照する。",
        "color": "#f59e0b",
        "title_property": "name",
    })
    sg_tid = sg_type["id"]
    print(f"  ServerGroup ObjectType: id={sg_tid}")

    print("=== Creating ServerGroup Properties ===")
    sg_props = [
        ("Name", "name", "string"),
        ("Description", "description", "string"),
        ("Count", "count", "integer"),
        ("Environment", "env", "string"),
        ("Source Type", "source_type", "string"),
        ("Source DSN", "source_dsn", "string"),
        ("Source Table", "source_table", "string"),
        ("Source Filter", "source_filter", "string"),
        ("MCP Hint", "mcp_hint", "string"),
        ("Representative Servers", "representative_servers", "string"),
    ]
    for name, api_name, dtype in sg_props:
        p = post("/ontology/properties", {
            "object_type_id": sg_tid, "name": name,
            "api_name": api_name, "data_type": dtype,
        })
        print(f"  Property: {name} (id={p['id']})")

    # ═══════════════════════════════════════════
    # 5. ServerGroup Instances
    # ═══════════════════════════════════════════
    print("=== Creating ServerGroup Instances ===")
    sg_data = [
        {
            "name": "本番 Web サーバー群",
            "description": "ユーザー向け Web アプリケーション (Nginx + Node.js)",
            "count": 120,
            "env": "production",
            "source_type": "mysql",
            "source_dsn": "cmdb-db.internal:3306/cmdb",
            "source_table": "servers",
            "source_filter": "role = 'web' AND env = 'production'",
            "mcp_hint": "MySQL MCP → cmdb-db.internal:3306/cmdb\n"
                        "SELECT hostname, ip, status, cpu, memory_gb, launched_at\n"
                        "  FROM servers\n"
                        " WHERE role = 'web' AND env = 'production'\n"
                        " ORDER BY hostname;",
            "representative_servers": "web-prod-01 (10.1.1.11), web-prod-02 (10.1.1.12), web-prod-03 (10.1.1.13)",
        },
        {
            "name": "本番 API サーバー群",
            "description": "REST API バックエンド (FastAPI). api-prod-02 は現在 SOUT (メモリ増設中)",
            "count": 80,
            "env": "production",
            "source_type": "mysql",
            "source_dsn": "cmdb-db.internal:3306/cmdb",
            "source_table": "servers",
            "source_filter": "role = 'api' AND env = 'production'",
            "mcp_hint": "MySQL MCP → cmdb-db.internal:3306/cmdb\n"
                        "SELECT hostname, ip, status, cpu, memory_gb, launched_at\n"
                        "  FROM servers\n"
                        " WHERE role = 'api' AND env = 'production'\n"
                        " ORDER BY hostname;\n"
                        "\n"
                        "※ SOUT サーバーの詳細:\n"
                        "SELECT * FROM servers WHERE status = 'SOUT' AND role = 'api';",
            "representative_servers": "api-prod-01 (10.1.1.21, SIN), api-prod-02 (10.1.1.22, SOUT)",
        },
        {
            "name": "本番バッチサーバー群",
            "description": "夜間バッチ処理 (日次集計, レポート生成). batch-admins グループ権限が必要",
            "count": 15,
            "env": "production",
            "source_type": "mysql",
            "source_dsn": "cmdb-db.internal:3306/cmdb",
            "source_table": "servers",
            "source_filter": "role = 'batch' AND env = 'production'",
            "mcp_hint": "MySQL MCP → cmdb-db.internal:3306/cmdb\n"
                        "SELECT hostname, ip, status, cpu, memory_gb, launched_at\n"
                        "  FROM servers\n"
                        " WHERE role = 'batch' AND env = 'production'\n"
                        " ORDER BY hostname;\n"
                        "\n"
                        "※ cron ジョブ一覧:\n"
                        "SELECT * FROM cron_jobs WHERE server_role = 'batch';",
            "representative_servers": "batch-prod-01 (10.1.2.10)",
        },
        {
            "name": "ステージング全サーバー群",
            "description": "ステージング環境 (本番同等構成). VPN 接続必須",
            "count": 30,
            "env": "staging",
            "source_type": "mysql",
            "source_dsn": "cmdb-db.internal:3306/cmdb",
            "source_table": "servers",
            "source_filter": "env = 'staging'",
            "mcp_hint": "MySQL MCP → cmdb-db.internal:3306/cmdb\n"
                        "SELECT hostname, ip, status, role, cpu, memory_gb\n"
                        "  FROM servers\n"
                        " WHERE env = 'staging'\n"
                        " ORDER BY role, hostname;",
            "representative_servers": "web-stg-01 (10.2.1.11), api-stg-01 (10.2.1.21)",
        },
    ]
    sg_ids = []
    for sg in sg_data:
        obj = post("/ontology/objects", {"object_type_id": sg_tid, "properties": sg})
        sg_ids.append(obj["id"])
        print(f"  ServerGroup: {sg['name']} (id={obj['id']})")

    # ═══════════════════════════════════════════
    # 6. LinkType: maintains (Team → ServerGroup)
    # ═══════════════════════════════════════════
    print("=== Creating LinkType: maintains ===")
    lt_maintains = post("/ontology/link-types", {
        "name": "maintains",
        "api_name": "team_maintains_group",
        "project_id": pid,
        "source_object_type_id": t_tid,
        "target_object_type_id": sg_tid,
        "cardinality": "many_to_many",
        "description": "チームがサーバーグループの運用を担当 (アプリ運用 or インフラ運用)",
        "inverse_name": "maintained_by",
    })
    lt_maint_id = lt_maintains["id"]
    print(f"  LinkType: maintains (id={lt_maint_id})")

    # ═══════════════════════════════════════════
    # 7. Link Instances: maintains (Team → ServerGroup)
    # ═══════════════════════════════════════════
    print("=== Creating Links: maintains ===")
    maint_links = [
        (infra_id,  sg_ids[0], "インフラ → 本番Web群"),
        (infra_id,  sg_ids[1], "インフラ → 本番API群"),
        (infra_id,  sg_ids[2], "インフラ → 本番バッチ群"),
        (infra_id,  sg_ids[3], "インフラ → ステージング群"),
        (alpha_id,  sg_ids[0], "Alpha → 本番Web群"),
        (bravo_id,  sg_ids[1], "Bravo → 本番API群"),
    ]
    for src, tgt, label in maint_links:
        link = post("/ontology/links", {
            "link_type_id": lt_maint_id,
            "source_object_id": src, "target_object_id": tgt,
        })
        print(f"  Link: {label} (id={link['id']})")

    # ═══════════════════════════════════════════
    # 8. App ObjectType + Properties
    # ═══════════════════════════════════════════
    print("=== Creating App Object Type ===")
    app_type = post("/ontology/object-types", {
        "name": "App",
        "api_name": "app",
        "project_id": pid,
        "description": "サーバーにデプロイされているアプリケーション",
        "color": "#10b981",
        "title_property": "name",
    })
    a_tid = app_type["id"]
    print(f"  App ObjectType: id={a_tid}")

    print("=== Creating App Properties ===")
    app_props = [
        ("Name", "name", "string"),
        ("Description", "description", "string"),
        ("Language", "language", "string"),
        ("Repository", "repo", "string"),
        ("Port", "port", "string"),
        ("Health Check", "health_check", "string"),
        ("Log Path", "log_path", "string"),
        ("Deploy Method", "deploy_method", "string"),
    ]
    for name, api_name, dtype in app_props:
        p = post("/ontology/properties", {
            "object_type_id": a_tid, "name": name,
            "api_name": api_name, "data_type": dtype,
        })
        print(f"  Property: {name} (id={p['id']})")

    # ═══════════════════════════════════════════
    # 9. App Instances
    # ═══════════════════════════════════════════
    print("=== Creating App Instances ===")
    apps_data = [
        {
            "name": "user-frontend",
            "description": "ユーザー向け SPA (React + Vite). Nginx でホスト",
            "language": "TypeScript / React",
            "repo": "github.com/acme/user-frontend",
            "port": "80, 443 (Nginx)",
            "health_check": "GET /health → 200",
            "log_path": "/opt/app/logs/app.log",
            "deploy_method": "GitHub Actions → Docker image → Kubernetes rolling update",
        },
        {
            "name": "core-api",
            "description": "REST API バックエンド. 認証・ユーザー管理・ビジネスロジック",
            "language": "Python / FastAPI",
            "repo": "github.com/acme/core-api",
            "port": "8000",
            "health_check": "GET /api/health → 200",
            "log_path": "/opt/api/logs/api.log",
            "deploy_method": "GitHub Actions → Docker image → Kubernetes rolling update",
        },
        {
            "name": "batch-aggregator",
            "description": "夜間バッチ (日次集計・レポート生成). cron トリガー",
            "language": "Python",
            "repo": "github.com/acme/batch-aggregator",
            "port": "N/A (CLI)",
            "health_check": "N/A (ジョブ終了コードで監視)",
            "log_path": "/opt/batch/logs/aggregator.log",
            "deploy_method": "Ansible playbook → systemd timer",
        },
        {
            "name": "admin-dashboard",
            "description": "社内管理画面. ステージング環境でのみ動作中 (本番未リリース)",
            "language": "TypeScript / Next.js",
            "repo": "github.com/acme/admin-dashboard",
            "port": "3000",
            "health_check": "GET / → 200",
            "log_path": "/opt/admin/logs/admin.log",
            "deploy_method": "手動デプロイ (npm run build → rsync)",
        },
    ]
    app_ids = []
    for a in apps_data:
        obj = post("/ontology/objects", {"object_type_id": a_tid, "properties": a})
        app_ids.append(obj["id"])
        print(f"  App: {a['name']} (id={obj['id']})")

    # ═══════════════════════════════════════════
    # 10. LinkType: develops (Team → App)
    # ═══════════════════════════════════════════
    print("=== Creating LinkType: develops ===")
    lt_develops = post("/ontology/link-types", {
        "name": "develops",
        "api_name": "team_develops_app",
        "project_id": pid,
        "source_object_type_id": t_tid,
        "target_object_type_id": a_tid,
        "cardinality": "many_to_many",
        "description": "チームがアプリケーションを開発・保守",
        "inverse_name": "developed_by",
    })
    lt_dev_id = lt_develops["id"]
    print(f"  LinkType: develops (id={lt_dev_id})")

    # ═══════════════════════════════════════════
    # 11. LinkType: deployed_on (App → ServerGroup)
    # ═══════════════════════════════════════════
    print("=== Creating LinkType: deployed_on ===")
    lt_deploy = post("/ontology/link-types", {
        "name": "deployed_on",
        "api_name": "app_deployed_on_group",
        "project_id": pid,
        "source_object_type_id": a_tid,
        "target_object_type_id": sg_tid,
        "cardinality": "many_to_many",
        "description": "アプリケーションがデプロイされているサーバーグループ",
        "inverse_name": "runs",
    })
    lt_deploy_id = lt_deploy["id"]
    print(f"  LinkType: deployed_on (id={lt_deploy_id})")

    # ═══════════════════════════════════════════
    # 12. Link Instances: develops (Team → App)
    # ═══════════════════════════════════════════
    print("=== Creating Links: develops ===")
    dev_links = [
        (alpha_id, app_ids[0], "Alpha → user-frontend"),
        (alpha_id, app_ids[3], "Alpha → admin-dashboard"),
        (bravo_id, app_ids[1], "Bravo → core-api"),
        (bravo_id, app_ids[2], "Bravo → batch-aggregator"),
    ]
    for src, tgt, label in dev_links:
        link = post("/ontology/links", {
            "link_type_id": lt_dev_id,
            "source_object_id": src, "target_object_id": tgt,
        })
        print(f"  Link: {label} (id={link['id']})")

    # ═══════════════════════════════════════════
    # 13. Link Instances: deployed_on (App → ServerGroup)
    # ═══════════════════════════════════════════
    print("=== Creating Links: deployed_on ===")
    deploy_links = [
        (app_ids[0], sg_ids[0], "user-frontend → 本番Web群"),
        (app_ids[0], sg_ids[3], "user-frontend → ステージング群"),
        (app_ids[1], sg_ids[1], "core-api → 本番API群"),
        (app_ids[1], sg_ids[3], "core-api → ステージング群"),
        (app_ids[2], sg_ids[2], "batch-aggregator → 本番バッチ群"),
        (app_ids[3], sg_ids[3], "admin-dashboard → ステージング群"),
    ]
    for src, tgt, label in deploy_links:
        link = post("/ontology/links", {
            "link_type_id": lt_deploy_id,
            "source_object_id": src, "target_object_id": tgt,
        })
        print(f"  Link: {label} (id={link['id']})")

    # ═══════════════════════════════════════════
    # 14. DBTable ObjectType + Properties
    # ═══════════════════════════════════════════
    print("=== Creating DBTable Object Type ===")
    db_type = post("/ontology/object-types", {
        "name": "DBTable",
        "api_name": "db_table",
        "project_id": pid,
        "description": "MySQL テーブル。アプリが参照/書き込みするデータストア",
        "color": "#ef4444",
        "title_property": "name",
    })
    db_tid = db_type["id"]
    print(f"  DBTable ObjectType: id={db_tid}")

    print("=== Creating DBTable Properties ===")
    db_props = [
        ("Name", "name", "string"),
        ("Schema", "schema", "string"),
        ("Description", "description", "string"),
        ("DSN", "dsn", "string"),
        ("Estimated Rows", "estimated_rows", "string"),
        ("Key Columns", "key_columns", "string"),
        ("MCP Hint", "mcp_hint", "string"),
    ]
    for name, api_name, dtype in db_props:
        p = post("/ontology/properties", {
            "object_type_id": db_tid, "name": name,
            "api_name": api_name, "data_type": dtype,
        })
        print(f"  Property: {name} (id={p['id']})")

    # ═══════════════════════════════════════════
    # 15. DBTable Instances
    # ═══════════════════════════════════════════
    print("=== Creating DBTable Instances ===")
    tables_data = [
        {
            "name": "users",
            "schema": "app_db",
            "description": "ユーザーマスタ。認証・プロフィール情報",
            "dsn": "app-db.internal:3306/app_db",
            "estimated_rows": "~500,000",
            "key_columns": "id (PK), email (UNIQUE), created_at",
            "mcp_hint": "MySQL MCP → app-db.internal:3306/app_db\n"
                        "DESCRIBE users;\n"
                        "SELECT COUNT(*) FROM users;\n"
                        "SELECT * FROM users ORDER BY created_at DESC LIMIT 10;",
        },
        {
            "name": "orders",
            "schema": "app_db",
            "description": "注文テーブル。ユーザーの購買履歴",
            "dsn": "app-db.internal:3306/app_db",
            "estimated_rows": "~2,000,000",
            "key_columns": "id (PK), user_id (FK→users), status, ordered_at",
            "mcp_hint": "MySQL MCP → app-db.internal:3306/app_db\n"
                        "DESCRIBE orders;\n"
                        "SELECT status, COUNT(*) FROM orders GROUP BY status;\n"
                        "SELECT * FROM orders WHERE ordered_at >= CURDATE() - INTERVAL 7 DAY LIMIT 20;",
        },
        {
            "name": "products",
            "schema": "app_db",
            "description": "商品マスタ。カテゴリ・価格・在庫",
            "dsn": "app-db.internal:3306/app_db",
            "estimated_rows": "~50,000",
            "key_columns": "id (PK), sku (UNIQUE), category, price",
            "mcp_hint": "MySQL MCP → app-db.internal:3306/app_db\n"
                        "DESCRIBE products;\n"
                        "SELECT category, COUNT(*) FROM products GROUP BY category;",
        },
        {
            "name": "daily_reports",
            "schema": "analytics_db",
            "description": "日次集計レポート。batch-aggregator が毎晩書き込み",
            "dsn": "analytics-db.internal:3306/analytics_db",
            "estimated_rows": "~3,000 (日次 × 年数)",
            "key_columns": "id (PK), report_date (UNIQUE), total_orders, total_revenue",
            "mcp_hint": "MySQL MCP → analytics-db.internal:3306/analytics_db\n"
                        "DESCRIBE daily_reports;\n"
                        "SELECT * FROM daily_reports ORDER BY report_date DESC LIMIT 30;",
        },
        {
            "name": "audit_logs",
            "schema": "app_db",
            "description": "監査ログ。API 操作の記録 (誰が何をいつ)",
            "dsn": "app-db.internal:3306/app_db",
            "estimated_rows": "~10,000,000",
            "key_columns": "id (PK), user_id, action, resource, created_at",
            "mcp_hint": "MySQL MCP → app-db.internal:3306/app_db\n"
                        "DESCRIBE audit_logs;\n"
                        "SELECT action, COUNT(*) FROM audit_logs\n"
                        " WHERE created_at >= CURDATE() - INTERVAL 1 DAY\n"
                        " GROUP BY action ORDER BY COUNT(*) DESC;",
        },
    ]
    table_ids = []
    for t in tables_data:
        obj = post("/ontology/objects", {"object_type_id": db_tid, "properties": t})
        table_ids.append(obj["id"])
        print(f"  DBTable: {t['schema']}.{t['name']} (id={obj['id']})")

    # ═══════════════════════════════════════════
    # 16. LinkType: calls (App → App)
    # ═══════════════════════════════════════════
    print("=== Creating LinkType: calls ===")
    lt_calls = post("/ontology/link-types", {
        "name": "calls",
        "api_name": "app_calls_app",
        "project_id": pid,
        "source_object_type_id": a_tid,
        "target_object_type_id": a_tid,
        "cardinality": "many_to_many",
        "description": "アプリ間の API 呼び出し",
        "inverse_name": "called_by",
    })
    lt_calls_id = lt_calls["id"]
    print(f"  LinkType: calls (id={lt_calls_id})")

    # ═══════════════════════════════════════════
    # 17. LinkType: reads_table (App → DBTable)
    # ═══════════════════════════════════════════
    print("=== Creating LinkType: reads_table ===")
    lt_reads = post("/ontology/link-types", {
        "name": "reads_table",
        "api_name": "app_reads_table",
        "project_id": pid,
        "source_object_type_id": a_tid,
        "target_object_type_id": db_tid,
        "cardinality": "many_to_many",
        "description": "アプリが参照/書き込みする MySQL テーブル",
        "inverse_name": "used_by",
    })
    lt_reads_id = lt_reads["id"]
    print(f"  LinkType: reads_table (id={lt_reads_id})")

    # ═══════════════════════════════════════════
    # 18. Link Instances: calls (App → App)
    # ═══════════════════════════════════════════
    print("=== Creating Links: calls ===")
    # user-frontend → core-api (SPA が REST API を呼ぶ)
    # admin-dashboard → core-api (管理画面が REST API を呼ぶ)
    # batch-aggregator → core-api (集計前にマスタ取得)
    call_links = [
        (app_ids[0], app_ids[1], "user-frontend → core-api"),
        (app_ids[3], app_ids[1], "admin-dashboard → core-api"),
        (app_ids[2], app_ids[1], "batch-aggregator → core-api"),
    ]
    for src, tgt, label in call_links:
        link = post("/ontology/links", {
            "link_type_id": lt_calls_id,
            "source_object_id": src, "target_object_id": tgt,
        })
        print(f"  Link: {label} (id={link['id']})")

    # ═══════════════════════════════════════════
    # 19. Link Instances: reads_table (App → DBTable)
    # ═══════════════════════════════════════════
    print("=== Creating Links: reads_table ===")
    # core-api: users, orders, products, audit_logs
    # batch-aggregator: orders, products, daily_reports
    # admin-dashboard: users, orders, audit_logs
    read_links = [
        (app_ids[1], table_ids[0], "core-api → users"),
        (app_ids[1], table_ids[1], "core-api → orders"),
        (app_ids[1], table_ids[2], "core-api → products"),
        (app_ids[1], table_ids[4], "core-api → audit_logs"),
        (app_ids[2], table_ids[1], "batch-aggregator → orders"),
        (app_ids[2], table_ids[2], "batch-aggregator → products"),
        (app_ids[2], table_ids[3], "batch-aggregator → daily_reports"),
        (app_ids[3], table_ids[0], "admin-dashboard → users"),
        (app_ids[3], table_ids[1], "admin-dashboard → orders"),
        (app_ids[3], table_ids[4], "admin-dashboard → audit_logs"),
    ]
    for src, tgt, label in read_links:
        link = post("/ontology/links", {
            "link_type_id": lt_reads_id,
            "source_object_id": src, "target_object_id": tgt,
        })
        print(f"  Link: {label} (id={link['id']})")

    # ═══════════════════════════════════════════
    # 20. LogPipeline ObjectType + Properties
    # ═══════════════════════════════════════════
    print("=== Creating LogPipeline Object Type ===")
    lp_type = post("/ontology/object-types", {
        "name": "LogPipeline",
        "api_name": "log_pipeline",
        "project_id": pid,
        "description": "ログ収集・変換パイプライン (Fluentd/Fluent Bit → S3 → Hive → Trino)",
        "color": "#06b6d4",
        "title_property": "name",
    })
    lp_tid = lp_type["id"]
    print(f"  LogPipeline ObjectType: id={lp_tid}")

    print("=== Creating LogPipeline Properties ===")
    lp_props = [
        ("Name", "name", "string"),
        ("Description", "description", "string"),
        ("Log Format", "log_format", "string"),
        ("Collector", "collector", "string"),
        ("Storage", "storage", "string"),
        ("Batch Schedule", "batch_schedule", "string"),
        ("Retention", "retention", "string"),
        ("MCP Hint", "mcp_hint", "string"),
    ]
    for name, api_name, dtype in lp_props:
        p = post("/ontology/properties", {
            "object_type_id": lp_tid, "name": name,
            "api_name": api_name, "data_type": dtype,
        })
        print(f"  Property: {name} (id={p['id']})")

    # ═══════════════════════════════════════════
    # 21. LogPipeline Instances
    # ═══════════════════════════════════════════
    print("=== Creating LogPipeline Instances ===")
    pipelines_data = [
        {
            "name": "access-log-pipeline",
            "description": "HTTP アクセスログ収集。Nginx / FastAPI のリクエストログ",
            "log_format": "JSON (timestamp, method, path, status, latency_ms, user_id, request_id)",
            "collector": "Fluent Bit → Kinesis Firehose",
            "storage": "s3://data-lake/logs/access/ (Parquet, dt=YYYY-MM-DD パーティション)",
            "batch_schedule": "毎時 0分: Hive MSCK REPAIR TABLE (パーティション追加)",
            "retention": "90日 (S3 Lifecycle)",
            "mcp_hint": "このパイプラインのデータは TrinoTable 'access_logs' を参照してください。\n"
                        "produces リンクを追って TrinoTable の mcp_hint を確認してください。",
        },
        {
            "name": "app-event-pipeline",
            "description": "アプリケーションイベントログ。ユーザー操作 / ビジネスイベント",
            "log_format": "JSON (timestamp, event_type, user_id, payload, app_name, trace_id)",
            "collector": "Fluent Bit → Kinesis Firehose",
            "storage": "s3://data-lake/logs/events/ (Parquet, dt=YYYY-MM-DD パーティション)",
            "batch_schedule": "毎時 0分: Hive MSCK REPAIR TABLE",
            "retention": "180日",
            "mcp_hint": "このパイプラインのデータは TrinoTable 'app_events' を参照してください。\n"
                        "produces リンクを追って TrinoTable の mcp_hint を確認してください。",
        },
        {
            "name": "batch-job-pipeline",
            "description": "バッチジョブ実行ログ。開始/終了/エラー/処理件数",
            "log_format": "JSON (timestamp, job_name, status, rows_processed, duration_sec, error)",
            "collector": "Fluent Bit → Kinesis Firehose",
            "storage": "s3://data-lake/logs/batch_jobs/ (Parquet, dt=YYYY-MM-DD)",
            "batch_schedule": "毎時 0分: Hive MSCK REPAIR TABLE",
            "retention": "365日",
            "mcp_hint": "このパイプラインのデータは TrinoTable 'batch_job_logs' を参照してください。\n"
                        "produces リンクを追って TrinoTable の mcp_hint を確認してください。",
        },
    ]
    pipeline_ids = []
    for lp in pipelines_data:
        obj = post("/ontology/objects", {"object_type_id": lp_tid, "properties": lp})
        pipeline_ids.append(obj["id"])
        print(f"  LogPipeline: {lp['name']} (id={obj['id']})")

    # ═══════════════════════════════════════════
    # 22. TrinoTable ObjectType + Properties
    # ═══════════════════════════════════════════
    print("=== Creating TrinoTable Object Type ===")
    tt_type = post("/ontology/object-types", {
        "name": "TrinoTable",
        "api_name": "trino_table",
        "project_id": pid,
        "description": "Trino でクエリ可能な Hive テーブル。ログ分析用",
        "color": "#ec4899",
        "title_property": "name",
    })
    tt_tid = tt_type["id"]
    print(f"  TrinoTable ObjectType: id={tt_tid}")

    print("=== Creating TrinoTable Properties ===")
    tt_props = [
        ("Name", "name", "string"),
        ("Catalog.Schema", "catalog_schema", "string"),
        ("Description", "description", "string"),
        ("Partition Key", "partition_key", "string"),
        ("Key Columns", "key_columns", "string"),
        ("Trino Endpoint", "trino_endpoint", "string"),
        ("MCP Hint", "mcp_hint", "string"),
    ]
    for name, api_name, dtype in tt_props:
        p = post("/ontology/properties", {
            "object_type_id": tt_tid, "name": name,
            "api_name": api_name, "data_type": dtype,
        })
        print(f"  Property: {name} (id={p['id']})")

    # ═══════════════════════════════════════════
    # 23. TrinoTable Instances
    # ═══════════════════════════════════════════
    print("=== Creating TrinoTable Instances ===")
    trino_data = [
        {
            "name": "access_logs",
            "catalog_schema": "hive.logs",
            "description": "HTTP アクセスログ。リクエスト単位のレイテンシ・ステータスコード・ユーザー分析",
            "partition_key": "dt (DATE, YYYY-MM-DD)",
            "key_columns": "timestamp, method, path, status, latency_ms, user_id, request_id, app_name",
            "trino_endpoint": "trino.internal:8443/hive",
            "mcp_hint": "Trino MCP → trino.internal:8443\n"
                        "-- 試験導入分析: 特定アプリのエラー率・レイテンシを確認\n"
                        "SELECT app_name, status,\n"
                        "       COUNT(*) AS cnt,\n"
                        "       AVG(latency_ms) AS avg_latency,\n"
                        "       APPROX_PERCENTILE(latency_ms, 0.99) AS p99_latency\n"
                        "  FROM hive.logs.access_logs\n"
                        " WHERE dt >= CURRENT_DATE - INTERVAL '7' DAY\n"
                        "   AND app_name = '<アプリ名>'\n"
                        " GROUP BY app_name, status\n"
                        " ORDER BY cnt DESC;\n"
                        "\n"
                        "-- 時系列トレンド\n"
                        "SELECT dt,\n"
                        "       COUNT(*) AS requests,\n"
                        "       SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS errors\n"
                        "  FROM hive.logs.access_logs\n"
                        " WHERE dt >= CURRENT_DATE - INTERVAL '30' DAY\n"
                        "   AND app_name = '<アプリ名>'\n"
                        " GROUP BY dt ORDER BY dt;",
        },
        {
            "name": "app_events",
            "catalog_schema": "hive.logs",
            "description": "アプリケーションイベント。ユーザー行動・ビジネスイベントの分析",
            "partition_key": "dt (DATE, YYYY-MM-DD)",
            "key_columns": "timestamp, event_type, user_id, app_name, payload, trace_id",
            "trino_endpoint": "trino.internal:8443/hive",
            "mcp_hint": "Trino MCP → trino.internal:8443\n"
                        "-- 試験導入分析: イベント種別の頻度\n"
                        "SELECT event_type, app_name, COUNT(*) AS cnt\n"
                        "  FROM hive.logs.app_events\n"
                        " WHERE dt >= CURRENT_DATE - INTERVAL '7' DAY\n"
                        "   AND app_name = '<アプリ名>'\n"
                        " GROUP BY event_type, app_name\n"
                        " ORDER BY cnt DESC\n"
                        " LIMIT 50;\n"
                        "\n"
                        "-- ユニークユーザー数 (DAU)\n"
                        "SELECT dt, COUNT(DISTINCT user_id) AS dau\n"
                        "  FROM hive.logs.app_events\n"
                        " WHERE dt >= CURRENT_DATE - INTERVAL '30' DAY\n"
                        "   AND app_name = '<アプリ名>'\n"
                        " GROUP BY dt ORDER BY dt;",
        },
        {
            "name": "batch_job_logs",
            "catalog_schema": "hive.logs",
            "description": "バッチジョブ実行履歴。成功/失敗・処理時間・処理件数",
            "partition_key": "dt (DATE, YYYY-MM-DD)",
            "key_columns": "timestamp, job_name, status, rows_processed, duration_sec, error",
            "trino_endpoint": "trino.internal:8443/hive",
            "mcp_hint": "Trino MCP → trino.internal:8443\n"
                        "-- バッチジョブ成功率\n"
                        "SELECT job_name, status, COUNT(*) AS cnt\n"
                        "  FROM hive.logs.batch_job_logs\n"
                        " WHERE dt >= CURRENT_DATE - INTERVAL '30' DAY\n"
                        " GROUP BY job_name, status;\n"
                        "\n"
                        "-- 失敗ジョブの詳細\n"
                        "SELECT * FROM hive.logs.batch_job_logs\n"
                        " WHERE status = 'FAILED'\n"
                        "   AND dt >= CURRENT_DATE - INTERVAL '7' DAY\n"
                        " ORDER BY timestamp DESC;",
        },
        {
            "name": "error_summary",
            "catalog_schema": "hive.logs",
            "description": "エラー集約ビュー。access_logs + app_events から日次バッチで生成",
            "partition_key": "dt (DATE, YYYY-MM-DD)",
            "key_columns": "dt, app_name, error_type, count, sample_trace_id",
            "trino_endpoint": "trino.internal:8443/hive",
            "mcp_hint": "Trino MCP → trino.internal:8443\n"
                        "-- 試験導入後のエラーサマリ(★ 最初に実行するとよい)\n"
                        "SELECT app_name, error_type, SUM(count) AS total_errors\n"
                        "  FROM hive.logs.error_summary\n"
                        " WHERE dt >= CURRENT_DATE - INTERVAL '7' DAY\n"
                        "   AND app_name = '<アプリ名>'\n"
                        " GROUP BY app_name, error_type\n"
                        " ORDER BY total_errors DESC;\n"
                        "\n"
                        "-- エラーのトレンド\n"
                        "SELECT dt, SUM(count) AS daily_errors\n"
                        "  FROM hive.logs.error_summary\n"
                        " WHERE app_name = '<アプリ名>'\n"
                        "   AND dt >= CURRENT_DATE - INTERVAL '30' DAY\n"
                        " GROUP BY dt ORDER BY dt;",
        },
    ]
    trino_ids = []
    for tt in trino_data:
        obj = post("/ontology/objects", {"object_type_id": tt_tid, "properties": tt})
        trino_ids.append(obj["id"])
        print(f"  TrinoTable: {tt['catalog_schema']}.{tt['name']} (id={obj['id']})")

    # ═══════════════════════════════════════════
    # 24. LinkType: emits_log (App → LogPipeline)
    # ═══════════════════════════════════════════
    print("=== Creating LinkType: emits_log ===")
    lt_emits = post("/ontology/link-types", {
        "name": "emits_log",
        "api_name": "app_emits_log",
        "project_id": pid,
        "source_object_type_id": a_tid,
        "target_object_type_id": lp_tid,
        "cardinality": "many_to_many",
        "description": "アプリがログを出力するパイプライン",
        "inverse_name": "collects_from",
    })
    lt_emits_id = lt_emits["id"]
    print(f"  LinkType: emits_log (id={lt_emits_id})")

    # ═══════════════════════════════════════════
    # 25. LinkType: produces (LogPipeline → TrinoTable)
    # ═══════════════════════════════════════════
    print("=== Creating LinkType: produces ===")
    lt_produces = post("/ontology/link-types", {
        "name": "produces",
        "api_name": "pipeline_produces_table",
        "project_id": pid,
        "source_object_type_id": lp_tid,
        "target_object_type_id": tt_tid,
        "cardinality": "one_to_many",
        "description": "パイプラインが生成する Trino クエリ可能テーブル",
        "inverse_name": "produced_by",
    })
    lt_produces_id = lt_produces["id"]
    print(f"  LinkType: produces (id={lt_produces_id})")

    # ═══════════════════════════════════════════
    # 26. Link Instances: emits_log (App → LogPipeline)
    # ═══════════════════════════════════════════
    print("=== Creating Links: emits_log ===")
    # user-frontend, core-api → access-log-pipeline (HTTP リクエストログ)
    # user-frontend, core-api, admin-dashboard → app-event-pipeline (イベント)
    # batch-aggregator → batch-job-pipeline (ジョブ実行ログ)
    emit_links = [
        (app_ids[0], pipeline_ids[0], "user-frontend → access-log-pipeline"),
        (app_ids[1], pipeline_ids[0], "core-api → access-log-pipeline"),
        (app_ids[0], pipeline_ids[1], "user-frontend → app-event-pipeline"),
        (app_ids[1], pipeline_ids[1], "core-api → app-event-pipeline"),
        (app_ids[3], pipeline_ids[1], "admin-dashboard → app-event-pipeline"),
        (app_ids[2], pipeline_ids[2], "batch-aggregator → batch-job-pipeline"),
    ]
    for src, tgt, label in emit_links:
        link = post("/ontology/links", {
            "link_type_id": lt_emits_id,
            "source_object_id": src, "target_object_id": tgt,
        })
        print(f"  Link: {label} (id={link['id']})")

    # ═══════════════════════════════════════════
    # 27. Link Instances: produces (LogPipeline → TrinoTable)
    # ═══════════════════════════════════════════
    print("=== Creating Links: produces ===")
    # access-log-pipeline → access_logs, error_summary
    # app-event-pipeline → app_events, error_summary
    # batch-job-pipeline → batch_job_logs
    prod_links = [
        (pipeline_ids[0], trino_ids[0], "access-log-pipeline → access_logs"),
        (pipeline_ids[0], trino_ids[3], "access-log-pipeline → error_summary"),
        (pipeline_ids[1], trino_ids[1], "app-event-pipeline → app_events"),
        (pipeline_ids[1], trino_ids[3], "app-event-pipeline → error_summary"),
        (pipeline_ids[2], trino_ids[2], "batch-job-pipeline → batch_job_logs"),
    ]
    for src, tgt, label in prod_links:
        link = post("/ontology/links", {
            "link_type_id": lt_produces_id,
            "source_object_id": src, "target_object_id": tgt,
        })
        print(f"  Link: {label} (id={link['id']})")

    # ═══════════════════════════════════════════
    # Summary
    # ═══════════════════════════════════════════
    all_links = [maint_links, dev_links, deploy_links, call_links, read_links, emit_links, prod_links]
    total_links = sum(len(l) for l in all_links)
    print("\n✅ Tutorial data seeded successfully!")
    print(f"   Project: {pid}")
    print(f"   Team ObjectType: {t_tid} ({len(teams_data)} instances)")
    print(f"   ServerGroup ObjectType: {sg_tid} ({len(sg_data)} instances)")
    print(f"   App ObjectType: {a_tid} ({len(apps_data)} instances)")
    print(f"   DBTable ObjectType: {db_tid} ({len(tables_data)} instances)")
    print(f"   LogPipeline ObjectType: {lp_tid} ({len(pipelines_data)} instances)")
    print(f"   TrinoTable ObjectType: {tt_tid} ({len(trino_data)} instances)")
    print(f"   LinkTypes: maintains({lt_maint_id}), develops({lt_dev_id}), deployed_on({lt_deploy_id}), calls({lt_calls_id}), reads_table({lt_reads_id}), emits_log({lt_emits_id}), produces({lt_produces_id})")
    print(f"   Total links: {total_links}")
    print()
    print("   📌 個別サーバーはグラフに含まれません。")
    print("   📌 ServerGroup の mcp_hint で CMDB (MySQL) を MCP 参照")
    print("   📌 App → emits_log → LogPipeline → produces → TrinoTable のパスで")
    print("      ログ分析用 Trino クエリを MCP 経由で実行できます。")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)
