"""Seed the knowledge graph with dummy "software dev team" data.

Run while the backend is up at http://localhost:8000.

    python3 scripts/seed_dummy.py
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:8000/api/ontology"


def _req(method: str, path: str, body: dict | None = None) -> dict | list | None:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if data else {},
    )
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print(f"  ! {method} {path} -> {e.code} {e.read().decode(errors='replace')}", file=sys.stderr)
        raise


def post(path: str, body: dict) -> dict:
    return _req("POST", path, body)


def patch(path: str, body: dict) -> dict:
    return _req("PATCH", path, body)


def get(path: str) -> list | dict | None:
    return _req("GET", path)


def delete(path: str) -> None:
    _req("DELETE", path)


def wipe() -> None:
    """Delete all existing ontology data so the seed is idempotent."""
    print("== Wipe existing data ==")
    for link in get("/links?limit=1000") or []:
        delete(f"/links/{link['id']}")
    for obj in get("/objects?limit=1000") or []:
        delete(f"/objects/{obj['id']}")
    for lt in get("/link-types") or []:
        delete(f"/link-types/{lt['id']}")
    for ot in get("/object-types?limit=1000") or []:
        delete(f"/object-types/{ot['id']}")
    print("  cleared")


def main() -> None:
    wipe()
    print("== ObjectTypes ==")
    ot_specs = [
        {"name": "Person",     "api_name": "person",     "description": "A team member.",                "icon": "user",      "color": "#6366f1"},
        {"name": "Team",       "api_name": "team",       "description": "A group of people.",            "icon": "users",     "color": "#10b981"},
        {"name": "Project",    "api_name": "project",    "description": "A piece of work being done.",   "icon": "briefcase", "color": "#f59e0b"},
        {"name": "Repository", "api_name": "repository", "description": "A source code repository.",     "icon": "code",      "color": "#ef4444"},
    ]
    ots: dict[str, dict] = {}
    for spec in ot_specs:
        obj = post("/object-types", spec)
        ots[spec["api_name"]] = obj
        print(f"  ObjectType {spec['api_name']} -> id={obj['id']}")

    print("== PropertyTypes ==")
    prop_specs = [
        # Person
        ("person", "name",  "string", True),
        ("person", "role",  "string", False),
        ("person", "email", "string", False),
        # Team
        ("team", "name",        "string", True),
        ("team", "description", "string", False),
        # Project
        ("project", "name",   "string", True),
        ("project", "status", "string", False),
        # Repository
        ("repository", "name",     "string", True),
        ("repository", "url",      "string", False),
        ("repository", "language", "string", False),
    ]
    for ot_api, api_name, data_type, is_required in prop_specs:
        body = {
            "object_type_id": ots[ot_api]["id"],
            "name": api_name,
            "api_name": api_name,
            "data_type": data_type,
            "is_required": is_required,
        }
        post("/properties", body)
        print(f"  Property {ot_api}.{api_name}")

    print("== ObjectType title_property updates ==")
    for ot_api in ("person", "team", "project", "repository"):
        patch(f"/object-types/{ots[ot_api]['id']}", {"title_property": "name", "primary_key_property": "name"})

    print("== LinkTypes ==")
    lt_specs = [
        {"name": "belongs_to", "api_name": "belongs_to", "description": "Person belongs to Team",  "source": "person",  "target": "team",       "cardinality": "many_to_many", "inverse_name": "members"},
        {"name": "works_on",   "api_name": "works_on",   "description": "Person works on Project", "source": "person",  "target": "project",    "cardinality": "many_to_many", "inverse_name": "contributors"},
        {"name": "owns",       "api_name": "owns",       "description": "Team owns Project",       "source": "team",    "target": "project",    "cardinality": "one_to_many",  "inverse_name": "owner"},
        {"name": "contains",   "api_name": "contains",   "description": "Project contains Repo",   "source": "project", "target": "repository", "cardinality": "one_to_many",  "inverse_name": "project"},
    ]
    lts: dict[str, dict] = {}
    for spec in lt_specs:
        body = {
            "name": spec["name"],
            "api_name": spec["api_name"],
            "description": spec["description"],
            "source_object_type_id": ots[spec["source"]]["id"],
            "target_object_type_id": ots[spec["target"]]["id"],
            "cardinality": spec["cardinality"],
            "inverse_name": spec["inverse_name"],
        }
        link = post("/link-types", body)
        lts[spec["api_name"]] = link
        print(f"  LinkType {spec['api_name']} -> id={link['id']}")

    print("== ObjectInstances ==")
    persons = [
        {"name": "Alice Tanaka",   "role": "Engineering Manager", "email": "alice@example.com"},
        {"name": "Bob Suzuki",     "role": "Backend Engineer",    "email": "bob@example.com"},
        {"name": "Carol Yamada",   "role": "Frontend Engineer",   "email": "carol@example.com"},
        {"name": "Dan Watanabe",   "role": "SRE",                 "email": "dan@example.com"},
        {"name": "Eve Sato",       "role": "Data Scientist",      "email": "eve@example.com"},
    ]
    teams = [
        {"name": "Platform",     "description": "Core platform team"},
        {"name": "Product",      "description": "Customer-facing product team"},
        {"name": "Data",         "description": "Data infrastructure & analytics"},
    ]
    projects = [
        {"name": "Knowledge Graph Hub", "status": "active"},
        {"name": "Auth Service",        "status": "active"},
        {"name": "Analytics Pipeline",  "status": "planning"},
    ]
    repos = [
        {"name": "kg-hub",        "url": "https://example.com/kg-hub.git",        "language": "Python"},
        {"name": "kg-hub-frontend", "url": "https://example.com/kg-hub-frontend.git", "language": "TypeScript"},
        {"name": "auth-svc",      "url": "https://example.com/auth-svc.git",      "language": "Go"},
        {"name": "analytics-etl", "url": "https://example.com/analytics-etl.git", "language": "Python"},
    ]

    def create_objs(ot_api: str, items: list[dict]) -> list[dict]:
        out = []
        for props in items:
            obj = post("/objects", {"object_type_id": ots[ot_api]["id"], "properties": props})
            print(f"  {ot_api} #{obj['id']} {props.get('name')}")
            out.append(obj)
        return out

    person_objs  = create_objs("person",     persons)
    team_objs    = create_objs("team",       teams)
    project_objs = create_objs("project",    projects)
    repo_objs    = create_objs("repository", repos)

    p = {o["properties"]["name"]: o["id"] for o in person_objs}
    t = {o["properties"]["name"]: o["id"] for o in team_objs}
    pr = {o["properties"]["name"]: o["id"] for o in project_objs}
    r = {o["properties"]["name"]: o["id"] for o in repo_objs}

    print("== LinkInstances ==")
    links = [
        # belongs_to
        ("belongs_to", p["Alice Tanaka"], t["Platform"]),
        ("belongs_to", p["Bob Suzuki"],   t["Platform"]),
        ("belongs_to", p["Carol Yamada"], t["Product"]),
        ("belongs_to", p["Dan Watanabe"], t["Platform"]),
        ("belongs_to", p["Eve Sato"],     t["Data"]),
        # works_on
        ("works_on", p["Alice Tanaka"], pr["Knowledge Graph Hub"]),
        ("works_on", p["Bob Suzuki"],   pr["Knowledge Graph Hub"]),
        ("works_on", p["Carol Yamada"], pr["Knowledge Graph Hub"]),
        ("works_on", p["Bob Suzuki"],   pr["Auth Service"]),
        ("works_on", p["Dan Watanabe"], pr["Auth Service"]),
        ("works_on", p["Eve Sato"],     pr["Analytics Pipeline"]),
        # owns
        ("owns", t["Platform"], pr["Knowledge Graph Hub"]),
        ("owns", t["Platform"], pr["Auth Service"]),
        ("owns", t["Data"],     pr["Analytics Pipeline"]),
        # contains
        ("contains", pr["Knowledge Graph Hub"], r["kg-hub"]),
        ("contains", pr["Knowledge Graph Hub"], r["kg-hub-frontend"]),
        ("contains", pr["Auth Service"],        r["auth-svc"]),
        ("contains", pr["Analytics Pipeline"],  r["analytics-etl"]),
    ]
    for lt_api, src, tgt in links:
        post("/links", {
            "link_type_id": lts[lt_api]["id"],
            "source_object_id": src,
            "target_object_id": tgt,
            "properties": {},
        })
        print(f"  {lt_api}: {src} -> {tgt}")

    print()
    print(f"Done. ObjectTypes={len(ots)} LinkTypes={len(lts)} Objects={len(person_objs)+len(team_objs)+len(project_objs)+len(repo_objs)} Links={len(links)}")


if __name__ == "__main__":
    main()
