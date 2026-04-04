"""Seed the database with tutorial data (Server Management Knowledge Graph)."""
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
    # --- 1. Project ---
    print("=== Creating Project ===")
    project = post("/projects", {
        "name": "Infra Knowledge",
        "description": "サーバー管理 × 組織構造 ナレッジグラフ",
    })
    pid = project["id"]
    print(f"  Project: id={pid}")

    # --- 2. Server Object Type ---
    print("=== Creating Server Object Type ===")
    server_type = post("/ontology/object-types", {
        "name": "Server",
        "api_name": "server",
        "project_id": pid,
        "description": "物理/仮想サーバーのインベントリ",
        "color": "#10b981",
    })
    sid = server_type["id"]
    print(f"  Server ObjectType: id={sid}")

    # --- 3. Server Properties ---
    print("=== Creating Server Properties ===")
    server_props = [
        ("Hostname", "hostname"),
        ("IP Address", "ip_address"),
        ("Status", "status"),
        ("Environment", "env"),
        ("Log Path", "log_path"),
        ("Access Method", "access_method"),
        ("Purpose", "purpose"),
    ]
    for name, api_name in server_props:
        p = post("/ontology/properties", {
            "object_type_id": sid,
            "name": name,
            "api_name": api_name,
            "data_type": "string",
        })
        print(f"  Property: {name} (id={p['id']})")

    # --- 4. Server Instances ---
    print("=== Creating Server Instances ===")
    servers_data = [
        {
            "hostname": "web-prod-01",
            "ip_address": "10.1.1.11",
            "status": "SIN",
            "env": "production",
            "log_path": "/var/log/nginx/access.log, /opt/app/logs/app.log",
            "access_method": "ssh -J bastion.internal web-prod-01",
            "purpose": "ユーザー向け Web アプリケーション (Nginx + Node.js)",
        },
        {
            "hostname": "api-prod-01",
            "ip_address": "10.1.1.21",
            "status": "SIN",
            "env": "production",
            "log_path": "/opt/api/logs/api.log, /var/log/syslog",
            "access_method": "ssh -J bastion.internal api-prod-01",
            "purpose": "REST API バックエンド (FastAPI)",
        },
        {
            "hostname": "api-prod-02",
            "ip_address": "10.1.1.22",
            "status": "SOUT",
            "env": "production",
            "log_path": "/opt/api/logs/api.log, /var/log/syslog",
            "access_method": "ssh -J bastion.internal api-prod-02",
            "purpose": "REST API バックエンド (FastAPI) - メモリ増設のためSOUT中",
        },
        {
            "hostname": "batch-prod-01",
            "ip_address": "10.1.2.10",
            "status": "SIN",
            "env": "production",
            "log_path": "/var/log/cron.log, /opt/batch/logs/",
            "access_method": "ssh -J bastion.internal batch-prod-01 (要: batch-adminsグループ)",
            "purpose": "夜間バッチ処理 (日次集計, レポート生成)",
        },
        {
            "hostname": "web-stg-01",
            "ip_address": "10.2.1.11",
            "status": "SIN",
            "env": "staging",
            "log_path": "/var/log/nginx/access.log, /opt/app/logs/app.log",
            "access_method": "ssh web-stg-01 (VPN接続必須)",
            "purpose": "ステージング環境 Web (本番同等構成)",
        },
    ]
    server_ids = []
    for s in servers_data:
        obj = post("/ontology/objects", {
            "object_type_id": sid,
            "properties": s,
        })
        server_ids.append(obj["id"])
        print(f"  Server: {s['hostname']} (id={obj['id']})")

    # --- 5. Team Object Type ---
    print("=== Creating Team Object Type ===")
    team_type = post("/ontology/object-types", {
        "name": "Team",
        "api_name": "team",
        "project_id": pid,
        "description": "開発/インフラチームの情報",
        "color": "#8b5cf6",
    })
    tid = team_type["id"]
    print(f"  Team ObjectType: id={tid}")

    # --- 6. Team Properties ---
    print("=== Creating Team Properties ===")
    team_props = [
        ("Team Name", "name"),
        ("Slack Channel", "slack_channel"),
        ("Oncall Rotation", "oncall_rotation"),
        ("Lead", "lead"),
    ]
    for name, api_name in team_props:
        p = post("/ontology/properties", {
            "object_type_id": tid,
            "name": name,
            "api_name": api_name,
            "data_type": "string",
        })
        print(f"  Property: {name} (id={p['id']})")

    # --- 7. Team Instances ---
    print("=== Creating Team Instances ===")
    teams_data = [
        {
            "name": "開発チーム Alpha",
            "slack_channel": "#dev-alpha",
            "oncall_rotation": "毎週月曜ローテ: 田中→佐藤→鈴木",
            "lead": "田中 太郎",
        },
        {
            "name": "開発チーム Bravo",
            "slack_channel": "#dev-bravo",
            "oncall_rotation": "毎週月曜ローテ: 山田→高橋→伊藤",
            "lead": "山田 花子",
        },
        {
            "name": "インフラチーム",
            "slack_channel": "#infra-ops",
            "oncall_rotation": "PagerDuty: infra-oncall エスカレーション",
            "lead": "中村 健一",
        },
    ]
    team_ids = []
    for t in teams_data:
        obj = post("/ontology/objects", {
            "object_type_id": tid,
            "properties": t,
        })
        team_ids.append(obj["id"])
        print(f"  Team: {t['name']} (id={obj['id']})")

    # --- 8. Link Type: Team owns Server ---
    print("=== Creating Link Type ===")
    link_type = post("/ontology/link-types", {
        "name": "owns",
        "api_name": "team_owns_server",
        "project_id": pid,
        "source_object_type_id": tid,
        "target_object_type_id": sid,
        "cardinality": "one_to_many",
    })
    ltid = link_type["id"]
    print(f"  LinkType: owns (id={ltid})")

    # --- 9. Link Instances ---
    # Alpha -> web-prod-01, web-stg-01
    # Bravo -> api-prod-01, api-prod-02
    # Infra -> batch-prod-01
    links = [
        (team_ids[0], server_ids[0], "Alpha → web-prod-01"),
        (team_ids[0], server_ids[4], "Alpha → web-stg-01"),
        (team_ids[1], server_ids[1], "Bravo → api-prod-01"),
        (team_ids[1], server_ids[2], "Bravo → api-prod-02"),
        (team_ids[2], server_ids[3], "Infra → batch-prod-01"),
    ]
    print("=== Creating Links ===")
    for src, tgt, label in links:
        link = post("/ontology/links", {
            "link_type_id": ltid,
            "source_object_id": src,
            "target_object_id": tgt,
        })
        print(f"  Link: {label} (id={link['id']})")

    print("\n✅ Tutorial data seeded successfully!")
    print(f"   Project: {pid}")
    print(f"   Server ObjectType: {sid} ({len(servers_data)} instances)")
    print(f"   Team ObjectType: {tid} ({len(teams_data)} instances)")
    print(f"   LinkType: {ltid} ({len(links)} links)")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)
