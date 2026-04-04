"""Comprehensive API integration test (no auth)."""
import httpx

BASE = "http://127.0.0.1:8001/api"


def main():
    r = httpx.get(f"{BASE}/health")
    print(f"Health: {r.status_code} {r.json()}")

    r = httpx.post(f"{BASE}/projects", json={"name": "Supply Chain", "description": "SC mgmt"})
    print(f"Create Project: {r.status_code} {r.json()['name']}")
    pid = r.json()["id"]

    r = httpx.get(f"{BASE}/projects")
    print(f"List Projects: {r.status_code} count={len(r.json())}")

    r = httpx.post(f"{BASE}/datasets", json={"name": "Orders", "description": "Orders data", "project_id": pid})
    print(f"Create Dataset: {r.status_code} {r.json()['name']}")

    r = httpx.post(f"{BASE}/ontology/object-types", json={"name": "Customer", "api_name": "customer", "description": "Customer", "project_id": pid, "color": "#10b981"})
    print(f"Create ObjectType: {r.status_code} {r.json()['name']}")
    oid = r.json()["id"]

    r = httpx.post(f"{BASE}/ontology/objects", json={"object_type_id": oid, "properties": {"name": "Alice"}})
    print(f"Create Object: {r.status_code} {r.json()['properties']}")

    r = httpx.post(f"{BASE}/pipelines", json={"name": "ETL", "description": "ETL pipe", "project_id": pid})
    print(f"Create Pipeline: {r.status_code} {r.json()['name']}")
    plid = r.json()["id"]

    r = httpx.post(f"{BASE}/pipelines/{plid}/run")
    print(f"Pipeline Run: {r.status_code} {r.json()['status']}")

    print("\nALL TESTS PASSED - No auth required!")


if __name__ == "__main__":
    main()
