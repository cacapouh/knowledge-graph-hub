"""
KG Hub MCP Server
=================
GitHub Copilot (or any MCP client) から Knowledge Graph Hub を操作するための
MCP サーバー。SSE (HTTP) トランスポートで動作し、バックエンド API を呼び出す。

ツール一覧:
  - list_object_types         : ObjectType 一覧
  - get_object_type           : ObjectType 詳細
  - create_object_type        : ObjectType 新規作成
  - update_object_type        : ObjectType 更新
  - delete_object_type        : ObjectType 削除
  - list_objects              : ObjectInstance 一覧 (type でフィルタ可)
  - get_object                : ObjectInstance 詳細
  - create_object             : ObjectInstance 新規作成
  - update_object             : ObjectInstance プロパティ更新
  - delete_object             : ObjectInstance 削除
  - list_link_types           : LinkType 一覧
  - create_link_type          : LinkType 新規作成
  - list_links                : LinkInstance 一覧
  - create_link               : LinkInstance 新規作成
  - delete_link               : LinkInstance 削除
  - list_properties           : PropertyType 一覧 (ObjectType ごと)
  - create_property           : PropertyType 新規作成
  - search_graph              : グラフ全体のサマリー取得
  - graph_query               : Cypher クエリ実行 + Graph View URL 発行
  - propose_graph_changes     : Graph Pull Request 作成 (auto_merge で即時反映可)
  - list_gpr                  : GPR 一覧
  - get_gpr                   : GPR 詳細 (失敗時は apply_log にエラー)
  - apply_gpr                 : open な GPR を適用 (Approve 制では「承認&適用」)
  - close_gpr                 : open な GPR を適用せず却下する
  - revert_gpr                : merged な GPR を inverse_ops でロールバック
"""

import os

import httpx
from mcp.server.fastmcp import FastMCP

API_BASE = os.environ.get("API_BASE", "http://127.0.0.1:8000/api")
FRONTEND_BASE = os.environ.get("FRONTEND_BASE", "http://localhost:5173")
MCP_HOST = os.environ.get("MCP_HOST", "127.0.0.1")
MCP_PORT = int(os.environ.get("MCP_PORT", "8002"))

mcp = FastMCP(
    "KG Hub",
    instructions=(
        "Knowledge Graph Hub の MCP サーバーです。"
        "社内インフラのナレッジグラフ (Team, ServerGroup, App, DBTable, "
        "LogPipeline, TrinoTable など) を閲覧・編集できます。\n\n"
        "【グラフを書き換える方針】\n"
        "閲覧系 (list_*, get_*, graph_query, search_graph) は自由に使ってよい。\n"
        "書き換え系の create_*/update_*/delete_* は直接適用される。 暴走リスク回避のため、"
        "**自動抽出した「グラフへの提案」は propose_graph_changes (Graph Pull Request) を経由すること**。\n"
        "GPR ならユーザーが UI で差分を確認・Approve/Close でき、適用後も revert_gpr で戻せる。\n"
        "失敗した GPR の原因は get_gpr で取得し、apply_log[].error を読んで修正版を再 propose する。"
    ),
    host=MCP_HOST,
    port=MCP_PORT,
)


def _client() -> httpx.Client:
    return httpx.Client(base_url=API_BASE, timeout=30)


def _graph_url(highlight_id: int | None = None) -> str:
    """Graph View のプレビュー URL を生成する。"""
    if highlight_id is not None:
        return f"{FRONTEND_BASE}/graph?highlight={highlight_id}"
    return f"{FRONTEND_BASE}/graph"


def _cypher_url(cypher: str) -> str:
    """Cypher クエリ付きの Graph View URL を生成する。"""
    from urllib.parse import quote
    return f"{FRONTEND_BASE}/graph?cypher={quote(cypher)}"


# ─── Object Types ───────────────────────────────────────

@mcp.tool()
def list_object_types() -> str:
    """ObjectType の一覧を取得する。"""
    with _client() as c:
        r = c.get("/ontology/object-types")
        r.raise_for_status()
    return r.text


@mcp.tool()
def get_object_type(object_type_id: int) -> str:
    """指定 ID の ObjectType 詳細を取得する。"""
    with _client() as c:
        r = c.get(f"/ontology/object-types/{object_type_id}")
        r.raise_for_status()
    return r.text


@mcp.tool()
def create_object_type(
    name: str,
    api_name: str = "",
    color: str = "#6366f1",
    icon: str = "box",
    description: str = "",
) -> str:
    """新しい ObjectType を作成する。color は hex (#rrggbb)、icon は任意文字列。api_name 未指定時は name から生成。"""
    if not api_name:
        api_name = name.replace(" ", "_").lower()
    with _client() as c:
        r = c.post("/ontology/object-types", json={
            "name": name,
            "api_name": api_name,
            "color": color,
            "icon": icon,
            "description": description,
        })
        r.raise_for_status()
    return f"{r.text}\n\n📊 Graph View: {_graph_url()}"


@mcp.tool()
def update_object_type(
    object_type_id: int,
    name: str | None = None,
    color: str | None = None,
    icon: str | None = None,
    description: str | None = None,
) -> str:
    """ObjectType を更新する。変更したいフィールドだけ指定する。"""
    body = {}
    if name is not None:
        body["name"] = name
    if color is not None:
        body["color"] = color
    if icon is not None:
        body["icon"] = icon
    if description is not None:
        body["description"] = description
    with _client() as c:
        r = c.patch(f"/ontology/object-types/{object_type_id}", json=body)
        r.raise_for_status()
    return f"{r.text}\n\n📊 Graph View: {_graph_url()}"


@mcp.tool()
def delete_object_type(object_type_id: int) -> str:
    """ObjectType を削除する。関連する PropertyType や Instance も削除される可能性がある。"""
    with _client() as c:
        r = c.delete(f"/ontology/object-types/{object_type_id}")
        r.raise_for_status()
    return f"ObjectType {object_type_id} deleted\n\n📊 Graph View: {_graph_url()}"


# ─── Property Types ─────────────────────────────────────

@mcp.tool()
def list_properties(object_type_id: int) -> str:
    """指定 ObjectType に属する PropertyType の一覧を取得する。"""
    with _client() as c:
        r = c.get(f"/ontology/object-types/{object_type_id}/properties")
        r.raise_for_status()
    return r.text


@mcp.tool()
def create_property(
    object_type_id: int,
    name: str,
    data_type: str = "string",
    description: str = "",
) -> str:
    """ObjectType に新しい PropertyType を追加する。data_type: string, integer, float, boolean, datetime, json"""
    with _client() as c:
        r = c.post("/ontology/properties", json={
            "object_type_id": object_type_id,
            "name": name,
            "data_type": data_type,
            "description": description,
        })
        r.raise_for_status()
    return f"{r.text}\n\n📊 Graph View: {_graph_url()}"


# ─── Object Instances ───────────────────────────────────

@mcp.tool()
def list_objects(object_type_id: int | None = None, limit: int = 500) -> str:
    """ObjectInstance の一覧を取得する。object_type_id でフィルタ可能。"""
    params: dict = {"limit": limit}
    if object_type_id is not None:
        params["object_type_id"] = object_type_id
    with _client() as c:
        r = c.get("/ontology/objects", params=params)
        r.raise_for_status()
    return r.text


@mcp.tool()
def get_object(object_id: int) -> str:
    """指定 ID の ObjectInstance 詳細 (properties 含む) を取得する。"""
    with _client() as c:
        r = c.get(f"/ontology/objects/{object_id}")
        r.raise_for_status()
    return r.text


@mcp.tool()
def create_object(
    object_type_id: int,
    properties: dict,
) -> str:
    """新しい ObjectInstance を作成する。properties は {"key": "value", ...} の形式。"""
    with _client() as c:
        r = c.post("/ontology/objects", json={
            "object_type_id": object_type_id,
            "properties": properties,
        })
        r.raise_for_status()
    obj = r.json()
    return f"{r.text}\n\n📊 Graph View: {_graph_url(obj.get('id'))}"


@mcp.tool()
def update_object(object_id: int, properties: dict) -> str:
    """ObjectInstance の properties を更新する。"""
    with _client() as c:
        r = c.patch(f"/ontology/objects/{object_id}", json={
            "properties": properties,
        })
        r.raise_for_status()
    return f"{r.text}\n\n📊 Graph View: {_graph_url(object_id)}"


@mcp.tool()
def delete_object(object_id: int) -> str:
    """ObjectInstance を削除する。"""
    with _client() as c:
        r = c.delete(f"/ontology/objects/{object_id}")
        r.raise_for_status()
    return f"Object {object_id} deleted\n\n📊 Graph View: {_graph_url()}"


# ─── Link Types ─────────────────────────────────────────

@mcp.tool()
def list_link_types() -> str:
    """LinkType の一覧を取得する。"""
    with _client() as c:
        r = c.get("/ontology/link-types")
        r.raise_for_status()
    return r.text


@mcp.tool()
def create_link_type(
    name: str,
    source_object_type_id: int,
    target_object_type_id: int,
    api_name: str = "",
    description: str = "",
    cardinality: str = "many_to_many",
    inverse_name: str | None = None,
) -> str:
    """新しい LinkType を作成する。source/target は ObjectType の ID。api_name 未指定時は自動生成。"""
    if not api_name:
        api_name = name.replace(" ", "_").lower()
    body: dict = {
        "name": name,
        "api_name": api_name,
        "source_object_type_id": source_object_type_id,
        "target_object_type_id": target_object_type_id,
        "cardinality": cardinality,
        "description": description,
    }
    if inverse_name is not None:
        body["inverse_name"] = inverse_name
    with _client() as c:
        r = c.post("/ontology/link-types", json=body)
        r.raise_for_status()
    return f"{r.text}\n\n📊 Graph View: {_graph_url()}"


# ─── Link Instances ─────────────────────────────────────

@mcp.tool()
def list_links(link_type_id: int | None = None, limit: int = 2000) -> str:
    """LinkInstance の一覧を取得する。link_type_id でフィルタ可能。"""
    params: dict = {"limit": limit}
    if link_type_id is not None:
        params["link_type_id"] = link_type_id
    with _client() as c:
        r = c.get("/ontology/links", params=params)
        r.raise_for_status()
    return r.text


@mcp.tool()
def create_link(
    link_type_id: int,
    source_object_id: int,
    target_object_id: int,
    properties: dict | None = None,
) -> str:
    """新しい LinkInstance を作成する。"""
    body: dict = {
        "link_type_id": link_type_id,
        "source_object_id": source_object_id,
        "target_object_id": target_object_id,
    }
    if properties is not None:
        body["properties"] = properties
    else:
        body["properties"] = {}
    with _client() as c:
        r = c.post("/ontology/links", json=body)
        r.raise_for_status()
    return f"{r.text}\n\n📊 Graph View: {_graph_url(source_object_id)}"


@mcp.tool()
def delete_link(link_id: int) -> str:
    """LinkInstance を削除する。"""
    with _client() as c:
        r = c.delete(f"/ontology/links/{link_id}")
        r.raise_for_status()
    return f"Link {link_id} deleted\n\n📊 Graph View: {_graph_url()}"


# ─── Graph Summary ──────────────────────────────────────

@mcp.tool()
def graph_query(cypher: str) -> str:
    """Cypher クエリを実行し、マッチしたノードとリンクを返す。結果を可視化する Graph View URL も付与。

    対応パターン:
      MATCH (n:Team) RETURN n
      MATCH (n:Team)-[:manages]->(m:App) RETURN n, r, m
      MATCH (n:Server {hostname: "web-01"}) RETURN n
      MATCH (n)-[:uses]->(m) RETURN n, r, m
    """
    with _client() as c:
        r = c.get("/ontology/cypher", params={"q": cypher})
        r.raise_for_status()
    data = r.json()
    n_obj = len(data.get("objects", []))
    n_link = len(data.get("links", []))
    url = _cypher_url(cypher)
    return f"{r.text}\n\nMatched {n_obj} nodes, {n_link} links\n📊 Graph View: {url}"


@mcp.tool()
def search_graph() -> str:
    """グラフ全体のサマリーを取得する。全 ObjectType、LinkType、ノード数、リンク数を返す。"""
    with _client() as c:
        ot_resp = c.get("/ontology/object-types")
        ot_resp.raise_for_status()
        object_types = ot_resp.json()

        lt_resp = c.get("/ontology/link-types")
        lt_resp.raise_for_status()
        link_types = lt_resp.json()

        obj_resp = c.get("/ontology/objects", params={"limit": 10000})
        obj_resp.raise_for_status()
        objects = obj_resp.json()

        link_resp = c.get("/ontology/links", params={"limit": 50000})
        link_resp.raise_for_status()
        links = link_resp.json()

    # Build summary
    lines = [f"=== Knowledge Graph Summary ==="]
    lines.append(f"Total ObjectTypes: {len(object_types)}")
    for ot in object_types:
        count = sum(1 for o in objects if o["object_type_id"] == ot["id"])
        lines.append(f"  - {ot['name']} (id={ot['id']}, color={ot['color']}, instances={count})")

    lines.append(f"\nTotal LinkTypes: {len(link_types)}")
    for lt in link_types:
        count = sum(1 for l in links if l["link_type_id"] == lt["id"])
        lines.append(f"  - {lt['name']} (id={lt['id']}, {lt['source_object_type_id']}→{lt['target_object_type_id']}, links={count})")

    lines.append(f"\nTotal Nodes: {len(objects)}")
    lines.append(f"Total Links: {len(links)}")
    return "\n".join(lines)


# ─── Graph Pull Request ─────────────────────────────────

@mcp.tool()
def propose_graph_changes(
    title: str,
    operations: list[dict],
    description: str = "",
    source: str = "",
    auto_merge: bool = True,
) -> str:
    """グラフ変更案 (Graph Pull Request) を作成する。

    operations は変更操作のリスト。各要素は以下のいずれか:
      {"op": "create_object", "client_id"?: str, "object_type": <api_name|id>, "properties": {...}}
      {"op": "update_object", "object_id": int, "properties": {...}}
      {"op": "delete_object", "object_id": int}
      {"op": "create_link",   "link_type": <api_name|id>,
                              "source": {"object_id": int} | {"client_id": str},
                              "target": {"object_id": int} | {"client_id": str},
                              "properties"?: {...}}
      {"op": "delete_link",   "link_id": int}

    client_id を使うと、同じ GPR 内の create_object と create_link を連結できる。
    auto_merge=True (デフォルト) なら作成と同時に適用。失敗すると status="failed"
    かつ apply_log にエラーが入るので、修正して再 propose すること。
    """
    body = {
        "title": title,
        "description": description,
        "source": source,
        "auto_merge": auto_merge,
        "operations": operations,
    }
    with _client() as c:
        r = c.post("/gpr", json=body)
        r.raise_for_status()
    data = r.json()
    return f"{r.text}\n\nGPR #{data['id']} status={data['status']}\n📊 Graph View: {_graph_url()}"


@mcp.tool()
def list_gpr(status: str | None = None, limit: int = 50) -> str:
    """GPR 一覧を取得する。status: open/merged/failed/reverted で絞り込み可。"""
    params: dict = {"limit": limit}
    if status:
        params["status"] = status
    with _client() as c:
        r = c.get("/gpr", params=params)
        r.raise_for_status()
    return r.text


@mcp.tool()
def get_gpr(gpr_id: int) -> str:
    """GPR 詳細を取得する。失敗した GPR の原因調査は apply_log[].error を見る。"""
    with _client() as c:
        r = c.get(f"/gpr/{gpr_id}")
        r.raise_for_status()
    return r.text


@mcp.tool()
def apply_gpr(gpr_id: int) -> str:
    """status=open の GPR を適用する。"""
    with _client() as c:
        r = c.post(f"/gpr/{gpr_id}/apply")
        r.raise_for_status()
    data = r.json()
    return f"{r.text}\n\nGPR #{gpr_id} status={data['status']}\n📊 Graph View: {_graph_url()}"


@mcp.tool()
def close_gpr(gpr_id: int) -> str:
    """status=open の GPR を適用せず却下する (reject)。"""
    with _client() as c:
        r = c.post(f"/gpr/{gpr_id}/close")
        r.raise_for_status()
    return f"{r.text}\n\nGPR #{gpr_id} closed"


@mcp.tool()
def revert_gpr(gpr_id: int) -> str:
    """status=merged の GPR を inverse_ops でロールバックする。"""
    with _client() as c:
        r = c.post(f"/gpr/{gpr_id}/revert")
        r.raise_for_status()
    return f"{r.text}\n\nGPR #{gpr_id} reverted\n📊 Graph View: {_graph_url()}"


if __name__ == "__main__":
    mcp.run(transport="sse")
