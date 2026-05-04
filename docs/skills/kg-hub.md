---
name: kg-hub
description: KG Hub (Knowledge Graph Hub) に対して「作業ログから抽出した知識」を Graph Pull Request として安全に提案するスキル。直接書き込まず、ユーザーが UI で確認・Approve できる形にする。
---

# KG Hub: グラフへの提案ガイド

このスキルは、Claude Code / Copilot などのクライアントが KG Hub の MCP サーバ
経由でグラフに知識を追加するときの作法を定める。

## 基本方針

ユーザーとの会話・コード変更・調査ログから「グラフ化できる事実」を見つけたら、
**直接 `create_object` / `create_link` を呼ばず、`propose_graph_changes` で
Graph Pull Request (GPR) を作る**。

理由:
- 直接書き込みは暴走時のロールバックが効かない
- GPR にすればユーザーは UI (`/gpr/:id`) で左右パネルの差分を見て Approve/Close できる
- 適用後も `revert_gpr` で戻せる

## いつ提案するか

- ユーザーが新しいシステム・チーム・人物・データソースに言及したとき
- コードレビューで「この App は this DB を参照している」のような関係を発見したとき
- 障害調査で「Pipeline X が Table Y を書いている」のような依存を確定したとき
- ユーザーが明示的に「KG に登録して」「メモして」と言ったとき

逆に提案しないケース:
- 不確かな推測 (`maybe`, `probably` レベルの情報)
- 短期間しか有効でない一時的な事実 (今日のデバッグセッション限定の値など)

## 提案の作り方

`propose_graph_changes` の引数:

- `title`: 「Alice (engineer) を追加し team-platform に所属させる」のように一文で要約
- `operations`: 変更操作リスト (下記の語彙を参照)
- `description`: 提案の根拠 (どの会話/コードから抽出したか)
- `source`: 自分のクライアント名。例: `"claude-code"`, `"copilot"`, `"claude-desktop"`
- `auto_merge`: 個人領域なら `True`、チーム領域なら `False` (ユーザー方針に従う)

## Operation 語彙

```jsonc
// 新規ノード (client_id があると同じ GPR 内のリンクから参照可能)
{"op": "create_object", "client_id": "alice",
 "object_type": "Person",         // api_name 文字列 or id (int) どちらでも
 "properties": {"name": "Alice", "role": "engineer"}}

// 既存ノード更新
{"op": "update_object", "object_id": 42,
 "properties": {"name": "Alice", "role": "tech-lead"}}

// 既存ノード削除
{"op": "delete_object", "object_id": 42}

// リンク作成 (両端は object_id か client_id の片方)
{"op": "create_link", "link_type": "belongs_to",
 "source": {"client_id": "alice"},
 "target": {"object_id": 7},
 "properties": {}}

// リンク削除
{"op": "delete_link", "link_id": 99}
```

## ベストプラクティス

1. **新規 ObjectType / LinkType は Phase 1 GPR では作れない**。
   存在しない型を使おうとすると `failed` になる。事前に `list_object_types` /
   `list_link_types` で確認、なければユーザーに「型を作ってもいい?」と聞く。

2. **client_id の命名はわかりやすく**。`alice` / `payments_db` のように
   ノードの本質を表す名前。`a1` `tmp` などは避ける。差分 UI でも見える。

3. **失敗したら apply_log を読む**。`get_gpr(id)` → `apply_log[].error` に
   Python の例外文字列がそのまま入ってる。多くは「型が無い」「id が存在しない」
   「link_type の source/target_object_type と endpoint が一致しない」等。

4. **proposed と applied のステータス管理**:
   - `auto_merge=True`: 即適用。失敗時 `status=failed` で残るので修正版を作って再提案
   - `auto_merge=False`: `status=open` のまま、ユーザーが UI で Approve するのを待つ

## サンプル: 1ターンで 2人 + 1リンク

```python
propose_graph_changes(
    title="Alice と Bob を Person として追加し、Alice が Bob を knows",
    description="本日の standup で Alice が Bob から引き継ぎを受ける旨を共有",
    source="claude-code",
    auto_merge=True,
    operations=[
        {"op": "create_object", "client_id": "alice",
         "object_type": "Person", "properties": {"name": "Alice"}},
        {"op": "create_object", "client_id": "bob",
         "object_type": "Person", "properties": {"name": "Bob"}},
        {"op": "create_link", "link_type": "knows",
         "source": {"client_id": "alice"},
         "target": {"client_id": "bob"},
         "properties": {"since": "2026-05"}},
    ],
)
```

## 関連 tool

- `propose_graph_changes` — GPR 作成
- `list_gpr(status="open")` — 提出済み一覧
- `get_gpr(id)` — 詳細 + apply_log
- `apply_gpr(id)` / `close_gpr(id)` / `revert_gpr(id)` — 状態遷移
- 既存 `list_object_types` / `list_link_types` / `list_objects` — 型・既存値の確認
