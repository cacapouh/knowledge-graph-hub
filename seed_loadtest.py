"""Seed the database with large-scale load test data.

Creates:
  - 1 Project: Load Test
  - 8 ObjectTypes: Service, Server, Database, API, Queue, Cache, Monitor, Config
  - ~300 ObjectInstances (varied across types)
  - 8 LinkTypes
  - ~600 LinkInstances

This exercises the Graph View under heavy node/edge load.
Run:  python3 seed_loadtest.py
"""
import os
import urllib.request
import json
import random
import sys

BASE = os.environ.get("API_BASE", "http://127.0.0.1:8000/api")


def get(path: str) -> list:
    req = urllib.request.Request(f"{BASE}{path}", method="GET")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


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


# ──────────────────────────────────────────────
# Object Type definitions
# ──────────────────────────────────────────────
TYPE_DEFS = [
    {
        "name": "Service",
        "api_name": "lt_service",
        "color": "#3b82f6",
        "description": "マイクロサービス",
        "title_property": "name",
        "properties": [
            ("name", "string"),
            ("language", "string"),
            ("owner_team", "string"),
            ("status", "string"),
        ],
        "gen": lambda i: {
            "name": f"svc-{random.choice(['auth','payment','user','order','search','catalog','inventory','notification','analytics','gateway','billing','shipping','review','recommendation','media','cdn','logging','metrics','tracing','config'])}-{i:03d}",
            "language": random.choice(["Go", "Python", "Java", "Rust", "TypeScript", "Kotlin"]),
            "owner_team": random.choice(["platform", "commerce", "data", "infra", "security", "frontend"]),
            "status": random.choice(["running", "running", "running", "degraded", "maintenance"]),
        },
        "count": 60,
    },
    {
        "name": "Server",
        "api_name": "lt_server",
        "color": "#f59e0b",
        "description": "物理/仮想サーバー",
        "title_property": "hostname",
        "properties": [
            ("hostname", "string"),
            ("ip_address", "string"),
            ("region", "string"),
            ("cpu_cores", "string"),
            ("memory_gb", "string"),
        ],
        "gen": lambda i: {
            "hostname": f"{random.choice(['web','api','db','cache','queue','batch','ml','data'])}-{random.choice(['prod','stg','dev'])}-{i:03d}",
            "ip_address": f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
            "region": random.choice(["ap-northeast-1", "us-east-1", "eu-west-1", "ap-southeast-1"]),
            "cpu_cores": str(random.choice([4, 8, 16, 32, 64])),
            "memory_gb": str(random.choice([8, 16, 32, 64, 128, 256])),
        },
        "count": 80,
    },
    {
        "name": "Database",
        "api_name": "lt_database",
        "color": "#ef4444",
        "description": "データベースインスタンス",
        "title_property": "name",
        "properties": [
            ("name", "string"),
            ("engine", "string"),
            ("version", "string"),
            ("size_gb", "string"),
        ],
        "gen": lambda i: {
            "name": f"db-{random.choice(['users','orders','products','sessions','logs','analytics','config','events','media','billing'])}-{i:03d}",
            "engine": random.choice(["PostgreSQL", "MySQL", "MongoDB", "Redis", "DynamoDB", "Cassandra"]),
            "version": random.choice(["14.2", "8.0", "6.0", "7.2", "3.11", "15.1"]),
            "size_gb": str(random.choice([50, 100, 250, 500, 1000, 2000])),
        },
        "count": 40,
    },
    {
        "name": "API Endpoint",
        "api_name": "lt_api_endpoint",
        "color": "#10b981",
        "description": "REST / gRPC エンドポイント",
        "title_property": "path",
        "properties": [
            ("path", "string"),
            ("method", "string"),
            ("latency_p99_ms", "string"),
        ],
        "gen": lambda i: {
            "path": f"/{random.choice(['v1','v2'])}/{random.choice(['users','orders','products','payments','search','auth','inventory','shipping','reviews','analytics'])}/{random.choice(['','list','create','update','delete','batch','stream'])}".rstrip("/"),
            "method": random.choice(["GET", "POST", "PUT", "DELETE", "PATCH"]),
            "latency_p99_ms": str(random.randint(5, 2000)),
        },
        "count": 50,
    },
    {
        "name": "Queue",
        "api_name": "lt_queue",
        "color": "#8b5cf6",
        "description": "メッセージキュー / トピック",
        "title_property": "name",
        "properties": [
            ("name", "string"),
            ("broker", "string"),
            ("throughput_mps", "string"),
        ],
        "gen": lambda i: {
            "name": f"{random.choice(['events','tasks','notifications','orders','logs','metrics','commands','dead-letter'])}.{random.choice(['created','updated','processed','failed','retry'])}.q{i:02d}",
            "broker": random.choice(["Kafka", "RabbitMQ", "SQS", "Redis Streams", "Pulsar"]),
            "throughput_mps": str(random.randint(100, 50000)),
        },
        "count": 30,
    },
    {
        "name": "Cache",
        "api_name": "lt_cache",
        "color": "#ec4899",
        "description": "キャッシュレイヤー",
        "title_property": "name",
        "properties": [
            ("name", "string"),
            ("engine", "string"),
            ("hit_rate", "string"),
        ],
        "gen": lambda i: {
            "name": f"cache-{random.choice(['session','product','user','config','rate-limit','geo','feature-flag','token'])}-{i:02d}",
            "engine": random.choice(["Redis", "Memcached", "Hazelcast", "ElastiCache"]),
            "hit_rate": f"{random.randint(70, 99)}.{random.randint(0,9)}%",
        },
        "count": 20,
    },
    {
        "name": "Monitor",
        "api_name": "lt_monitor",
        "color": "#06b6d4",
        "description": "監視アラート / ダッシュボード",
        "title_property": "name",
        "properties": [
            ("name", "string"),
            ("type", "string"),
            ("severity", "string"),
        ],
        "gen": lambda i: {
            "name": f"alert-{random.choice(['cpu-high','mem-high','disk-full','latency-spike','error-rate','5xx','queue-lag','connection-pool','deadlock','oom'])}-{i:02d}",
            "type": random.choice(["Datadog", "Prometheus", "CloudWatch", "Grafana", "PagerDuty"]),
            "severity": random.choice(["critical", "warning", "info", "critical", "warning"]),
        },
        "count": 20,
    },
]

# ──────────────────────────────────────────────
# Link Type definitions
# ──────────────────────────────────────────────
LINK_TYPE_DEFS = [
    ("deployed_on", "lt_deployed_on", "Service", "Server", "many_to_many", "デプロイ先"),
    ("connects_to", "lt_connects_to", "Service", "Database", "many_to_many", "DB接続"),
    ("exposes", "lt_exposes", "Service", "API Endpoint", "one_to_many", "エンドポイント公開"),
    ("publishes_to", "lt_publishes_to", "Service", "Queue", "many_to_many", "メッセージ送信"),
    ("consumes_from", "lt_consumes_from", "Service", "Queue", "many_to_many", "メッセージ受信"),
    ("uses_cache", "lt_uses_cache", "Service", "Cache", "many_to_many", "キャッシュ利用"),
    ("monitored_by", "lt_monitored_by", "Service", "Monitor", "many_to_many", "監視対象"),
    ("calls", "lt_calls", "Service", "Service", "many_to_many", "サービス間呼出"),
]


def main():
    random.seed(42)  # Reproducible

    links_only = "--links-only" in sys.argv

    if links_only:
        print("=== Links-only mode: reusing existing objects ===")
        existing_ots = get("/ontology/object-types")
        type_name_to_id = {ot["name"]: ot["id"] for ot in existing_ots}

        all_objects = get("/ontology/objects?limit=500")
        type_name_to_instance_ids: dict[str, list[int]] = {}
        id_to_type = {ot["id"]: ot["name"] for ot in existing_ots}
        for obj in all_objects:
            tn = id_to_type.get(obj["object_type_id"], "")
            type_name_to_instance_ids.setdefault(tn, []).append(obj["id"])

        total_objects = sum(len(v) for k, v in type_name_to_instance_ids.items()
                           if k in [t["name"] for t in TYPE_DEFS])
        print(f"  Found {total_objects} existing objects")
    else:
        # ═══════════════════════════════════════════
        # 1. Object Types + Properties + Instances
        # ═══════════════════════════════════════════
        type_name_to_id: dict[str, int] = {}
        type_name_to_instance_ids: dict[str, list[int]] = {}
        total_objects = 0

        for tdef in TYPE_DEFS:
            print(f"\n=== Creating ObjectType: {tdef['name']} ===")
            ot = post("/ontology/object-types", {
                "name": tdef["name"],
                "api_name": tdef["api_name"],
                "description": tdef["description"],
                "color": tdef["color"],
                "title_property": tdef["title_property"],
            })
            ot_id = ot["id"]
            type_name_to_id[tdef["name"]] = ot_id
            print(f"  ObjectType id={ot_id}")

            # Properties
            for prop_name, dtype in tdef["properties"]:
                post("/ontology/properties", {
                    "object_type_id": ot_id,
                    "name": prop_name,
                    "api_name": prop_name.lower().replace(" ", "_"),
                    "data_type": dtype,
                })

            # Instances
            instance_ids: list[int] = []
            gen_fn = tdef["gen"]
            count = tdef["count"]
            print(f"  Creating {count} instances...", end=" ", flush=True)
            for i in range(count):
                props = gen_fn(i)
                obj = post("/ontology/objects", {
                    "object_type_id": ot_id,
                    "properties": props,
                })
                instance_ids.append(obj["id"])
            total_objects += count
            type_name_to_instance_ids[tdef["name"]] = instance_ids
            print(f"done ({count} created, total={total_objects})")

    # ═══════════════════════════════════════════
    # 3. Link Types
    # ═══════════════════════════════════════════
    print("\n=== Creating Link Types ===")
    link_type_ids: dict[str, int] = {}
    for lt_name, lt_api_name, src_type, tgt_type, card, desc in LINK_TYPE_DEFS:
        src_id = type_name_to_id[src_type]
        tgt_id = type_name_to_id[tgt_type]
        lt = post("/ontology/link-types", {
            "name": lt_name,
            "api_name": lt_api_name,
            "source_object_type_id": src_id,
            "target_object_type_id": tgt_id,
            "cardinality": card,
            "description": desc,
        })
        link_type_ids[lt_name] = lt["id"]
        print(f"  LinkType: {lt_name} (id={lt['id']})")

    # ═══════════════════════════════════════════
    # 4. Link Instances (bulk)
    # ═══════════════════════════════════════════
    print("\n=== Creating Link Instances ===")
    total_links = 0
    services = type_name_to_instance_ids["Service"]
    servers = type_name_to_instance_ids["Server"]
    databases = type_name_to_instance_ids["Database"]
    endpoints = type_name_to_instance_ids["API Endpoint"]
    queues = type_name_to_instance_ids["Queue"]
    caches = type_name_to_instance_ids["Cache"]
    monitors = type_name_to_instance_ids["Monitor"]

    def create_links(lt_name: str, pairs: list[tuple[int, int]]):
        nonlocal total_links
        lt_id = link_type_ids[lt_name]
        for src, tgt in pairs:
            try:
                post("/ontology/links", {
                    "link_type_id": lt_id,
                    "source_object_id": src,
                    "target_object_id": tgt,
                })
                total_links += 1
            except Exception:
                pass  # skip duplicates / constraint violations
        print(f"  {lt_name}: {len(pairs)} attempted, total_links={total_links}")

    # Service → Server (each service on 2-4 servers)
    pairs = []
    for svc in services:
        for srv in random.sample(servers, random.randint(2, 4)):
            pairs.append((svc, srv))
    create_links("deployed_on", pairs)

    # Service → Database (each service connects to 1-3 DBs)
    pairs = []
    for svc in services:
        for db in random.sample(databases, random.randint(1, 3)):
            pairs.append((svc, db))
    create_links("connects_to", pairs)

    # Service → API Endpoint (each service exposes 1-3 endpoints)
    ep_idx = 0
    pairs = []
    for svc in services:
        n = random.randint(1, 3)
        for _ in range(n):
            if ep_idx < len(endpoints):
                pairs.append((svc, endpoints[ep_idx]))
                ep_idx += 1
    create_links("exposes", pairs)

    # Service → Queue (publish: ~40% of services publish to 1-2 queues)
    pairs = []
    for svc in random.sample(services, int(len(services) * 0.4)):
        for q in random.sample(queues, random.randint(1, 2)):
            pairs.append((svc, q))
    create_links("publishes_to", pairs)

    # Service → Queue (consume: ~40% of services consume from 1-2 queues)
    pairs = []
    for svc in random.sample(services, int(len(services) * 0.4)):
        for q in random.sample(queues, random.randint(1, 2)):
            pairs.append((svc, q))
    create_links("consumes_from", pairs)

    # Service → Cache (60% of services use 1-2 caches)
    pairs = []
    for svc in random.sample(services, int(len(services) * 0.6)):
        for c in random.sample(caches, random.randint(1, 2)):
            pairs.append((svc, c))
    create_links("uses_cache", pairs)

    # Service → Monitor (each service has 1-3 monitors)
    pairs = []
    for svc in services:
        for m in random.sample(monitors, random.randint(1, 3)):
            pairs.append((svc, m))
    create_links("monitored_by", pairs)

    # Service → Service (inter-service calls: ~50% call 1-3 other services)
    pairs = []
    for svc in random.sample(services, int(len(services) * 0.5)):
        others = [s for s in services if s != svc]
        for tgt in random.sample(others, min(random.randint(1, 3), len(others))):
            pairs.append((svc, tgt))
    create_links("calls", pairs)

    # ═══════════════════════════════════════════
    # Summary
    # ═══════════════════════════════════════════
    print(f"\n{'='*50}")
    print(f"✅ Load test data created!")
    print(f"   Object Types: {len(TYPE_DEFS)}")
    print(f"   Objects:      {total_objects}")
    print(f"   Link Types:   {len(LINK_TYPE_DEFS)}")
    print(f"   Links:        {total_links}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
