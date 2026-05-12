import type {
  LinkInstance,
  ObjectInstance,
  ViewCondition,
} from '../api/types'

export interface ConditionSelection {
  nodes: Set<number>
  links: Set<number>
}

function emptySelection(): ConditionSelection {
  return { nodes: new Set(), links: new Set() }
}

function bfsFromSeeds(
  seeds: Set<number>,
  allLinks: LinkInstance[],
  distance: number,
): ConditionSelection {
  const nodes = new Set<number>(seeds)
  const links = new Set<number>()
  let frontier = new Set<number>(seeds)
  for (let d = 0; d < distance && frontier.size > 0; d++) {
    const next = new Set<number>()
    for (const l of allLinks) {
      const sFrontier = frontier.has(l.source_object_id)
      const tFrontier = frontier.has(l.target_object_id)
      if (sFrontier && !nodes.has(l.target_object_id)) {
        next.add(l.target_object_id)
        links.add(l.id)
      }
      if (tFrontier && !nodes.has(l.source_object_id)) {
        next.add(l.source_object_id)
        links.add(l.id)
      }
    }
    next.forEach((id) => nodes.add(id))
    frontier = next
  }
  for (const l of allLinks) {
    if (nodes.has(l.source_object_id) && nodes.has(l.target_object_id)) {
      links.add(l.id)
    }
  }
  return { nodes, links }
}

function selectForTypeFilter(
  cond: { object_type_ids: number[]; link_type_ids: number[] },
  allObjects: ObjectInstance[],
  allLinks: LinkInstance[],
): ConditionSelection {
  const objectTypeFilter = new Set(cond.object_type_ids)
  const linkTypeFilter = new Set(cond.link_type_ids)
  const hasObjFilter = objectTypeFilter.size > 0
  const hasLinkFilter = linkTypeFilter.size > 0
  if (!hasObjFilter && !hasLinkFilter) return emptySelection()

  // Nodes: if object types are constrained, take matching nodes; otherwise no
  // node constraint (the link filter will determine endpoints).
  const nodes = new Set<number>()
  if (hasObjFilter) {
    for (const o of allObjects) {
      if (objectTypeFilter.has(o.object_type_id)) nodes.add(o.id)
    }
  } else {
    for (const o of allObjects) nodes.add(o.id)
  }

  const links = new Set<number>()
  for (const l of allLinks) {
    if (hasLinkFilter && !linkTypeFilter.has(l.link_type_id)) continue
    if (!nodes.has(l.source_object_id) || !nodes.has(l.target_object_id)) continue
    links.add(l.id)
  }
  // If only link types are constrained (no node constraint), restrict nodes to
  // endpoints of the chosen links so we don't drag in unrelated isolated nodes.
  if (!hasObjFilter && hasLinkFilter) {
    nodes.clear()
    for (const l of allLinks) {
      if (!linkTypeFilter.has(l.link_type_id)) continue
      nodes.add(l.source_object_id)
      nodes.add(l.target_object_id)
    }
  }
  return { nodes, links }
}

export function computeConditionSelection(
  cond: ViewCondition,
  allObjects: ObjectInstance[],
  allLinks: LinkInstance[],
): ConditionSelection {
  if (cond.kind === 'type_filter') {
    return selectForTypeFilter(cond, allObjects, allLinks)
  }
  if (cond.kind === 'neighborhood_of_type') {
    const seeds = new Set<number>()
    for (const o of allObjects) {
      if (o.object_type_id === cond.object_type_id) seeds.add(o.id)
    }
    if (seeds.size === 0) return emptySelection()
    return bfsFromSeeds(seeds, allLinks, Math.max(1, Math.min(5, cond.distance)))
  }
  if (cond.kind === 'neighborhood_of_ids') {
    const seeds = new Set<number>(cond.object_ids)
    if (seeds.size === 0) return emptySelection()
    return bfsFromSeeds(seeds, allLinks, Math.max(1, Math.min(5, cond.distance)))
  }
  return emptySelection()
}

/** OR-combine all condition selections. Returns null when no conditions are present. */
export function computeViewSelection(
  conditions: ViewCondition[] | undefined,
  allObjects: ObjectInstance[],
  allLinks: LinkInstance[],
): ConditionSelection | null {
  if (!conditions || conditions.length === 0) return null
  const merged: ConditionSelection = emptySelection()
  for (const c of conditions) {
    const sel = computeConditionSelection(c, allObjects, allLinks)
    sel.nodes.forEach((id) => merged.nodes.add(id))
    sel.links.forEach((id) => merged.links.add(id))
  }
  return merged
}
