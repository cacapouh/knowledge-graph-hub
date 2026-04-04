"""Seed the database with tutorial data (Server Management Knowledge Graph).

Creates:
  - 1 Project: Infra Knowledge
  - 2 ObjectTypes: Team, ServerGroup
  - 3 Team instances
  - 4 ServerGroup instances (外部DB参照型 — 個別Serverノードは持たない)
  - 1 LinkType: maintains (Team → ServerGroup)
  - 6 LinkInstances

Note: 個別サーバーはグラフに含めず、ServerGroup の外部DB参照
(source_dsn / source_table / mcp_hint) を使って MCP 経由で探索する設計。
"""
import urllib.request
import json
import sys

BASE = "http://127.0.0.1:8001/api"


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
    # Summary
    # ═══════════════════════════════════════════
    print("\n✅ Tutorial data seeded successfully!")
    print(f"   Project: {pid}")
    print(f"   Team ObjectType: {t_tid} ({len(teams_data)} instances)")
    print(f"   ServerGroup ObjectType: {sg_tid} ({len(sg_data)} instances)")
    print(f"   LinkType: maintains({lt_maint_id})")
    print(f"   Total links: {len(maint_links)}")
    print()
    print("   📌 個別サーバーはグラフに含まれません。")
    print("   📌 ServerGroup の mcp_hint / source_dsn / source_table を参照して")
    print("      MCP 経由で CMDB (MySQL) から個別サーバー情報を取得してください。")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)
