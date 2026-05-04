"""Graph Pull Request (GPR) end-to-end test against a live backend.

Usage:
  docker compose up -d backend  # or: uvicorn ... on :8000
  python test_gpr.py

Covers:
  1. auto_merge=True で 3 op (create_object x2 + create_link) を一括投入し client_id 参照を確認
  2. 実体が DB に作られていることを確認
  3. revert_gpr でロールバックされて元に戻ることを確認
  4. auto_merge=False で open のまま作成 → /apply で merged に遷移
  5. 不正な op (存在しない object_type) を投げて status=failed と apply_log を確認
  6. /close で open → closed
  7. link_type の source/target_object_type と endpoint が不一致 → failed (Phase 2 整合性チェック)
"""
import sys
import time

import httpx

BASE = "http://127.0.0.1:8000/api"


def _wait_for_backend(timeout: float = 30.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = httpx.get(f"{BASE}/health", timeout=2)
            if r.status_code == 200:
                return
        except httpx.RequestError:
            pass
        time.sleep(1)
    raise SystemExit(f"backend at {BASE} not ready")


def _check(cond: bool, msg: str) -> None:
    if not cond:
        print(f"  ✗ FAIL: {msg}")
        sys.exit(1)
    print(f"  ✓ {msg}")


def setup_types(suffix: str) -> tuple[int, int, str, str]:
    """Create scratch ObjectType + LinkType. Returns (ot_id, lt_id, ot_api, lt_api)."""
    ot_api = f"gpr_test_person_{suffix}"
    lt_api = f"gpr_test_knows_{suffix}"
    r = httpx.post(f"{BASE}/ontology/object-types", json={
        "name": f"GPRTestPerson_{suffix}", "api_name": ot_api,
    })
    r.raise_for_status()
    ot_id = r.json()["id"]

    r = httpx.post(f"{BASE}/ontology/link-types", json={
        "name": f"GPRTestKnows_{suffix}", "api_name": lt_api,
        "source_object_type_id": ot_id, "target_object_type_id": ot_id,
    })
    r.raise_for_status()
    lt_id = r.json()["id"]

    return ot_id, lt_id, ot_api, lt_api


def case_auto_merge_with_client_ids(ot_api: str, lt_api: str) -> int:
    print("\n[1] auto_merge=True: 2 objects + 1 link via client_id refs")
    operations = [
        {"op": "create_object", "client_id": "alice",
         "object_type": ot_api, "properties": {"name": "Alice"}},
        {"op": "create_object", "client_id": "bob",
         "object_type": ot_api, "properties": {"name": "Bob"}},
        {"op": "create_link", "link_type": lt_api,
         "source": {"client_id": "alice"}, "target": {"client_id": "bob"},
         "properties": {"since": "2026"}},
    ]
    r = httpx.post(f"{BASE}/gpr", json={
        "title": "alice knows bob",
        "source": "test_gpr.py",
        "auto_merge": True,
        "operations": operations,
    })
    r.raise_for_status()
    gpr = r.json()
    _check(gpr["status"] == "merged", f"GPR status=merged (got {gpr['status']})")
    _check(len(gpr["apply_log"]) == 3, f"apply_log has 3 entries (got {len(gpr['apply_log'])})")
    _check(all(e["ok"] for e in gpr["apply_log"]), "all ops ok=True")
    _check(len(gpr["inverse_ops"]) == 3, "inverse_ops captured")

    alice_id = gpr["apply_log"][0]["created_object_id"]
    bob_id = gpr["apply_log"][1]["created_object_id"]
    link_id = gpr["apply_log"][2]["created_link_id"]

    r = httpx.get(f"{BASE}/ontology/objects/{alice_id}")
    _check(r.status_code == 200 and r.json()["properties"]["name"] == "Alice",
           f"alice object exists (id={alice_id})")
    r = httpx.get(f"{BASE}/ontology/objects/{bob_id}")
    _check(r.status_code == 200 and r.json()["properties"]["name"] == "Bob",
           f"bob object exists (id={bob_id})")
    r = httpx.get(f"{BASE}/ontology/links")
    link_ids = [l["id"] for l in r.json()]
    _check(link_id in link_ids, f"link exists (id={link_id})")

    return gpr["id"]


def case_revert(gpr_id: int) -> None:
    print(f"\n[2] revert GPR #{gpr_id}")
    r = httpx.post(f"{BASE}/gpr/{gpr_id}/revert")
    r.raise_for_status()
    gpr = r.json()
    _check(gpr["status"] == "reverted", f"status=reverted (got {gpr['status']})")

    apply_log_extras = [e for e in gpr["apply_log"] if "created_object_id" in e]
    for entry in apply_log_extras:
        oid = entry["created_object_id"]
        r = httpx.get(f"{BASE}/ontology/objects/{oid}")
        _check(r.status_code == 404, f"object {oid} deleted by revert")


def case_manual_apply(ot_api: str) -> None:
    print("\n[3] auto_merge=False: open → apply")
    r = httpx.post(f"{BASE}/gpr", json={
        "title": "manual apply",
        "auto_merge": False,
        "operations": [
            {"op": "create_object", "object_type": ot_api, "properties": {"name": "Carol"}},
        ],
    })
    r.raise_for_status()
    gpr = r.json()
    _check(gpr["status"] == "open", f"status=open after create (got {gpr['status']})")
    _check(gpr["apply_log"] == [], "apply_log empty for unmerged GPR")

    r = httpx.post(f"{BASE}/gpr/{gpr['id']}/apply")
    r.raise_for_status()
    gpr2 = r.json()
    _check(gpr2["status"] == "merged", f"status=merged after apply (got {gpr2['status']})")
    _check(len(gpr2["apply_log"]) == 1, "apply_log populated")

    # cleanup
    httpx.post(f"{BASE}/gpr/{gpr['id']}/revert")


def case_failure() -> None:
    print("\n[4] failure: unknown object_type → status=failed")
    r = httpx.post(f"{BASE}/gpr", json={
        "title": "doomed",
        "auto_merge": True,
        "operations": [
            {"op": "create_object", "object_type": "no_such_type_xyz",
             "properties": {"name": "X"}},
        ],
    })
    r.raise_for_status()
    gpr = r.json()
    _check(gpr["status"] == "failed", f"status=failed (got {gpr['status']})")
    _check(len(gpr["apply_log"]) == 1 and gpr["apply_log"][0]["ok"] is False,
           "apply_log has one ok=False entry")
    _check("error" in gpr["apply_log"][0], "error string present for AI to read")
    print(f"     error: {gpr['apply_log'][0]['error']}")


def case_close(ot_api: str) -> None:
    print("\n[5] /close: open → closed")
    r = httpx.post(f"{BASE}/gpr", json={
        "title": "to be closed",
        "auto_merge": False,
        "operations": [
            {"op": "create_object", "object_type": ot_api, "properties": {"name": "Dropme"}},
        ],
    })
    r.raise_for_status()
    gpr_id = r.json()["id"]

    r = httpx.post(f"{BASE}/gpr/{gpr_id}/close")
    r.raise_for_status()
    gpr = r.json()
    _check(gpr["status"] == "closed", f"status=closed (got {gpr['status']})")

    # close on closed GPR should 400
    r = httpx.post(f"{BASE}/gpr/{gpr_id}/close")
    _check(r.status_code == 400, "double-close returns 400")


def case_link_type_mismatch(suffix: str) -> None:
    print("\n[6] integrity: link_type endpoint type mismatch → failed")
    # Create two distinct ObjectTypes and a LinkType A->A; then try to link an A to a B.
    r = httpx.post(f"{BASE}/ontology/object-types", json={
        "name": f"GPRMismatchA_{suffix}", "api_name": f"gpr_mismatch_a_{suffix}",
    })
    r.raise_for_status()
    type_a_id = r.json()["id"]
    type_a_api = r.json()["api_name"]

    r = httpx.post(f"{BASE}/ontology/object-types", json={
        "name": f"GPRMismatchB_{suffix}", "api_name": f"gpr_mismatch_b_{suffix}",
    })
    r.raise_for_status()
    type_b_api = r.json()["api_name"]

    r = httpx.post(f"{BASE}/ontology/link-types", json={
        "name": f"A2A_{suffix}", "api_name": f"a2a_{suffix}",
        "source_object_type_id": type_a_id, "target_object_type_id": type_a_id,
    })
    r.raise_for_status()
    lt_api = r.json()["api_name"]

    r = httpx.post(f"{BASE}/gpr", json={
        "title": "intentionally mismatched link",
        "auto_merge": True,
        "operations": [
            {"op": "create_object", "client_id": "a1", "object_type": type_a_api, "properties": {}},
            {"op": "create_object", "client_id": "b1", "object_type": type_b_api, "properties": {}},
            {"op": "create_link", "link_type": lt_api,
             "source": {"client_id": "a1"}, "target": {"client_id": "b1"}, "properties": {}},
        ],
    })
    r.raise_for_status()
    gpr = r.json()
    _check(gpr["status"] == "failed", f"status=failed (got {gpr['status']})")
    # The failing entry is the create_link (index 2)
    err_entries = [e for e in gpr["apply_log"] if e.get("ok") is False]
    _check(len(err_entries) == 1, "exactly one ok=False entry")
    _check("type mismatch" in err_entries[0].get("error", ""),
           f"error mentions 'type mismatch' (got: {err_entries[0].get('error')})")
    print(f"     error: {err_entries[0]['error']}")

    # Savepoint rollback: the two create_object ops must NOT have persisted.
    r = httpx.get(f"{BASE}/ontology/objects",
                  params={"object_type_id": type_a_id, "limit": 1000})
    a_count = sum(1 for o in r.json() if o["object_type_id"] == type_a_id)
    _check(a_count == 0, f"savepoint rolled back create_object (type A count={a_count})")


def case_list() -> None:
    print("\n[7] list_gpr")
    r = httpx.get(f"{BASE}/gpr", params={"limit": 100})
    r.raise_for_status()
    items = r.json()
    _check(len(items) >= 5, f"at least 5 GPRs listed (got {len(items)})")
    # Status filter
    r = httpx.get(f"{BASE}/gpr", params={"status": "closed"})
    r.raise_for_status()
    closed = r.json()
    _check(all(g["status"] == "closed" for g in closed), "status filter works")


def main() -> None:
    _wait_for_backend()
    suffix = str(int(time.time()))
    _, _, ot_api, lt_api = setup_types(suffix)

    gpr_id = case_auto_merge_with_client_ids(ot_api, lt_api)
    case_revert(gpr_id)
    case_manual_apply(ot_api)
    case_failure()
    case_close(ot_api)
    case_link_type_mismatch(suffix)
    case_list()

    print("\nAll GPR tests passed.")


if __name__ == "__main__":
    main()
