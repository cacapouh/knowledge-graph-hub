"""Seed the database with tutorial data (Server Management Knowledge Graph).

Creates:
  - 1 Project: Infra Knowledge
  - 3 ObjectTypes: Server, Team, ServerGroup
  - 5 Server instances (代表サーバー)
  - 3 Team instances
  - 4 ServerGroup instances (外部DB参照型)
  - 3 LinkTypes: owns, maintains, contains
  - 13 LinkInstances
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
    # 2. Server ObjectType + Properties
    # ═══════════════════════════════════════════
    print("=== Creating Server Object Type ===")
    server_type = post("/ontology/object-types", {
        "name": "Server",
        "api_name": "server",
        "project_id": pid,
        "description": "物理/仮想サーバーのインベントリ (代表サーバー)",
        "color": "#10b981",
        "title_property": "hostname",
    })
    s_tid = server_type["id"]
    print(f"  Server ObjectType: id={s_tid}")

    print("=== Creating Server Properties ===")
    for name, api_name in [
        ("Hostname", "hostname"),
        ("IP Address", "ip_address"),
        ("Status", "status"),
        ("Environment", "env"),
        ("Log Path", "log_path"),
        ("Access Method", "access_method"),
        ("Purpose", "purpose"),
    ]:
        p = post("/ontology/properties", {
            "object_type_id": s_tid, "name": name,
            "api_name": api_name, "data_type": "string",
        })
        print(f"  Property: {name} (id={p['id']})")

    # ═══════════════════════════════════════════
    # 3. Server Instances
    # ═══════════════════════════════════════════
    print("=== Creating Server Instances ===")
    servers_data = [
        {"hostname": "web-prod-01", "ip_address": "10.1.1.11", "status": "SIN",
         "env": "production",
         "log_path": "/var/log/nginx/access.log, /opt/app/logs/app.log",
         "access_method": "ssh -J bastion.internal web-prod-01",
         "purpose": "ユーザー向け Web アプリケーション (Nginx + Node.js)"},
        {"hostname": "api-prod-01", "ip_address": "10.1.1.21", "status": "SIN",
         "env": "production",
         "log_path": "/opt/api/logs/api.log, /var/log/syslog",
         "access_method": "ssh -J bastion.internal api-prod-01",
         "purpose": "REST API バックエンド (FastAPI)"},
        {"hostname": "api-prod-02", "ip_address": "10.1.1.22", "status": "SOUT",
         "env": "production",
         "log_path": "/opt/api/logs/api.log, /var/log/syslog",
         "access_method": "ssh -J bastion.internal api-prod-02",
         "purpose": "REST API バックエンド (FastAPI) - メモリ増設のためSOUT中"},
        {"hostname": "batch-prod-01", "ip_address": "10.1.2.10", "status": "SIN",
         "env": "production",
         "log_path": "/var/log/cron.log, /opt/batch/logs/",
         "access_method": "ssh -J bastion.internal batch-prod-01 (要: batch-adminsグループ)",
         "purpose": "夜間バッチ処理 (日次集計, レポート生成)"},
        {"hostname": "web-stg-01", "ip_address": "10.2.1.11", "status": "SIN",
         "env": "staging",
         "log_path": "/var/log/nginx/access.log, /opt/app/logs/app.log",
         "access_method": "ssh web-stg-01 (VPN接続必須)",
         "purpose": "ステージング環境 Web (本番同等構成)"},
    ]
    server_ids = []
    for s in servers_data:
        obj = post("/ontology/objects", {"object_type_id": s_tid, "properties": s})
        server_ids.append(obj["id"])
        print(f"  Server: {s['hostname']} (id={obj['id']})")

    # ═══════════════════════════════════════════
    # 4. Team ObjectType + Properties
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
    # 5. Team Instances
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
    # 6. ServerGroup ObjectType + Properties
    # ═══════════════════════════════════════════
    print("=== Creating ServerGroup Object Type ===")
    sg_type = post("/ontology/object-types", {
        "name": "ServerGroup",
        "api_name": "server_group",
        "project_id": pid,
        "description": "サーバー群 (数百台規模は外部DB参照で管理)",
        "color": "#f59e0b",
        "title_property": "name",
    })
    sg_tid = sg_type["id"]
    print(f"  ServerGroup ObjectType: id={sg_tid}")

    print("=== Creating ServerGroup Properties ===")
    sg_props = [
        ("Name", "name", "string"),
        ("Count", "count", "integer"),
        ("Environment", "env", "string"),
        ("Source Type", "source_type", "string"),
        ("Source DSN", "source_dsn", "string"),
        ("Source Table", "source_table", "string"),
        ("Source Filter", "source_filter", "string"),
        ("MCP Hint", "mcp_hint", "string"),
    ]
    for name, api_name, dtype in sg_props:
        p = post("/ontology/properties", {
            "object_type_id": sg_tid, "name": name,
            "api_name": api_name, "data_type": dtype,
        })
        print(f"  Property: {name} (id={p['id']})")

    # ═══════════════════════════════════════════
    # 7. ServerGroup Instances
    # ═══════════════════════════════════════════
    print("=== Creating ServerGroup Instances ===")
    sg_data = [
        {"name": "本番 Web サーバー群", "count": 120, "env": "production",
         "source_type": "mysql", "source_dsn": "cmdb-db.internal:3306/cmdb",
         "source_table": "servers", "source_filter": "role = 'web' AND env = 'production'",
         "mcp_hint": "MySQL MCP で SELECT hostname, ip, status FROM cmdb.servers WHERE role='web' AND env='production' を実行して一覧を取得してください"},
        {"name": "本番 API サーバー群", "count": 80, "env": "production",
         "source_type": "mysql", "source_dsn": "cmdb-db.internal:3306/cmdb",
         "source_table": "servers", "source_filter": "role = 'api' AND env = 'production'",
         "mcp_hint": "MySQL MCP で SELECT hostname, ip, status FROM cmdb.servers WHERE role='api' AND env='production' を実行して一覧を取得してください"},
        {"name": "本番バッチサーバー群", "count": 15, "env": "production",
         "source_type": "mysql", "source_dsn": "cmdb-db.internal:3306/cmdb",
         "source_table": "servers", "source_filter": "role = 'batch' AND env = 'production'",
         "mcp_hint": "MySQL MCP で SELECT hostname, ip, status FROM cmdb.servers WHERE role='batch' AND env='production' を実行して一覧を取得してください"},
        {"name": "ステージング全サーバー群", "count": 30, "env": "staging",
         "source_type": "mysql", "source_dsn": "cmdb-db.internal:3306/cmdb",
         "source_table": "servers", "source_filter": "env = 'staging'",
         "mcp_hint": "MySQL MCP で SELECT hostname, ip, status FROM cmdb.servers WHERE env='staging' を実行して一覧を取得してください"},
    ]
    sg_ids = []
    for sg in sg_data:
        obj = post("/ontology/objects", {"object_type_id": sg_tid, "properties": sg})
        sg_ids.append(obj["id"])
        print(f"  ServerGroup: {sg['name']} (id={obj['id']})")

    # ═══════════════════════════════════════════
    # 8. LinkType: owns (Team → Server)
    # ═══════════════════════════════════════════
    print("=== Creating LinkType: owns ===")
    lt_owns = post("/ontology/link-types", {
        "name": "owns",
        "api_name": "team_owns_server",
        "project_id": pid,
        "source_object_type_id": t_tid,
        "target_object_type_id": s_tid,
        "cardinality": "one_to_many",
        "description": "チームが代表サーバーのアプリ運用を管理",
        "inverse_name": "owned_by",
    })
    lt_owns_id = lt_owns["id"]
    print(f"  LinkType: owns (id={lt_owns_id})")

    # ═══════════════════════════════════════════
    # 9. LinkType: maintains (Team → ServerGroup)
    # ═══════════════════════════════════════════
    print("=== Creating LinkType: maintains ===")
    lt_maintains = post("/ontology/link-types", {
        "name": "maintains",
        "api_name": "team_maintains_group",
        "project_id": pid,
        "source_object_type_id": t_tid,
        "target_object_type_id": sg_tid,
        "cardinality": "many_to_many",
        "description": "チームがサーバーグループのインフラ作業 (ディスク交換・OS更新等) を担当",
        "inverse_name": "maintained_by",
    })
    lt_maint_id = lt_maintains["id"]
    print(f"  LinkType: maintains (id={lt_maint_id})")

    # ═══════════════════════════════════════════
    # 10. LinkType: contains (ServerGroup → Server)
    # ═══════════════════════════════════════════
    print("=== Creating LinkType: contains ===")
    lt_contains = post("/ontology/link-types", {
        "name": "contains",
        "api_name": "group_contains_server",
        "project_id": pid,
        "source_object_type_id": sg_tid,
        "target_object_type_id": s_tid,
        "cardinality": "one_to_many",
        "description": "サーバーグループに属する代表サーバー (残りは外部DB参照)",
        "inverse_name": "belongs_to",
    })
    lt_cont_id = lt_contains["id"]
    print(f"  LinkType: contains (id={lt_cont_id})")

    # ═══════════════════════════════════════════
    # 11. Link Instances
    # ═══════════════════════════════════════════
    print("=== Creating Links: owns (Team → Server) ===")
    owns_links = [
        (alpha_id, server_ids[0], "Alpha → web-prod-01"),
        (alpha_id, server_ids[4], "Alpha → web-stg-01"),
        (bravo_id, server_ids[1], "Bravo → api-prod-01"),
        (bravo_id, server_ids[2], "Bravo → api-prod-02"),
        (infra_id, server_ids[3], "Infra → batch-prod-01"),
    ]
    for src, tgt, label in owns_links:
        link = post("/ontology/links", {
            "link_type_id": lt_owns_id,
            "source_object_id": src, "target_object_id": tgt,
        })
        print(f"  Link: {label} (id={link['id']})")

    print("=== Creating Links: maintains (Team → ServerGroup) ===")
    maint_links = [
        (infra_id, sg_ids[0], "インフラ → 本番Web群"),
        (infra_id, sg_ids[1], "インフラ → 本番API群"),
        (infra_id, sg_ids[2], "インフラ → 本番バッチ群"),
        (infra_id, sg_ids[3], "インフラ → ステージング群"),
        (alpha_id, sg_ids[0], "Alpha → 本番Web群"),
        (bravo_id, sg_ids[1], "Bravo → 本番API群"),
    ]
    for src, tgt, label in maint_links:
        link = post("/ontology/links", {
            "link_type_id": lt_maint_id,
            "source_object_id": src, "target_object_id": tgt,
        })
        print(f"  Link: {label} (id={link['id']})")

    print("=== Creating Links: contains (ServerGroup → Server) ===")
    contains_links = [
        (sg_ids[0], server_ids[0], "本番Web群 → web-prod-01"),
        (sg_ids[1], server_ids[1], "本番API群 → api-prod-01"),
        (sg_ids[1], server_ids[2], "本番API群 → api-prod-02"),
        (sg_ids[2], server_ids[3], "本番バッチ群 → batch-prod-01"),
        (sg_ids[3], server_ids[4], "ステージング群 → web-stg-01"),
    ]
    for src, tgt, label in contains_links:
        link = post("/ontology/links", {
            "link_type_id": lt_cont_id,
            "source_object_id": src, "target_object_id": tgt,
        })
        print(f"  Link: {label} (id={link['id']})")

    # ═══════════════════════════════════════════
    # Summary
    # ═══════════════════════════════════════════
    print("\n✅ Tutorial data seeded successfully!")
    print(f"   Project: {pid}")
    print(f"   Server ObjectType: {s_tid} ({len(servers_data)} instances)")
    print(f"   Team ObjectType: {t_tid} ({len(teams_data)} instances)")
    print(f"   ServerGroup ObjectType: {sg_tid} ({len(sg_data)} instances)")
    print(f"   LinkTypes: owns({lt_owns_id}), maintains({lt_maint_id}), contains({lt_cont_id})")
    print(f"   Total links: {len(owns_links) + len(maint_links) + len(contains_links)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)
