import { blockId } from "./id"
import type { Block, BlockDoc } from "./types"

/**
 * Immutable operations on a BlockDoc. Each returns a new doc; the original is
 * untouched. Frontmatter is carried through unchanged. Collapse state is a
 * UI-only concern and lives in the editor component, not here.
 */

export function emptyBlock(content = ""): Block {
  return { id: blockId(), content, children: [] }
}

function clone(doc: BlockDoc): BlockDoc {
  return {
    frontmatter: doc.frontmatter,
    rootBlockIds: [...doc.rootBlockIds],
    blocks: { ...doc.blocks },
  }
}

/** null = top-level (parent is the root list); undefined = not found. */
function findParentId(doc: BlockDoc, id: string): string | null | undefined {
  if (doc.rootBlockIds.includes(id)) return null
  for (const [pid, block] of Object.entries(doc.blocks)) {
    if (block.children.includes(id)) return pid
  }
  return undefined
}

function siblingList(doc: BlockDoc, parentId: string | null): string[] {
  return parentId === null ? doc.rootBlockIds : doc.blocks[parentId].children
}

export function updateContent(doc: BlockDoc, id: string, content: string): BlockDoc {
  const block = doc.blocks[id]
  if (!block) return doc
  const next = clone(doc)
  next.blocks[id] = { ...block, content }
  return next
}

/** Insert `block` as a sibling immediately after `refId`. */
export function insertAfter(doc: BlockDoc, refId: string, block: Block): BlockDoc {
  return insertRelative(doc, refId, block, 1)
}

/** Insert `block` as a sibling immediately before `refId`. */
export function insertBefore(doc: BlockDoc, refId: string, block: Block): BlockDoc {
  return insertRelative(doc, refId, block, 0)
}

/** Splice `block` into `refId`'s sibling list at `refIndex + offset`. */
function insertRelative(doc: BlockDoc, refId: string, block: Block, offset: 0 | 1): BlockDoc {
  const parentId = findParentId(doc, refId)
  if (parentId === undefined) return doc
  const next = clone(doc)
  next.blocks[block.id] = block
  if (parentId === null) {
    const i = next.rootBlockIds.indexOf(refId)
    next.rootBlockIds.splice(i + offset, 0, block.id)
  } else {
    const parent = { ...next.blocks[parentId], children: [...next.blocks[parentId].children] }
    parent.children.splice(parent.children.indexOf(refId) + offset, 0, block.id)
    next.blocks[parentId] = parent
  }
  return next
}

/**
 * Replace the block `id` with the blocks of `sub` (a freshly parsed doc), in
 * order, at `id`'s position among its siblings. Any children of the replaced
 * block are re-parented onto the last inserted block so nothing is lost. Used
 * by paste, which parses the clipboard markdown into `sub`. Returns the new doc
 * and the id of the last inserted block (to place the caret), or `null` if
 * `id` is unknown or `sub` is empty.
 */
export function spliceBlocks(
  doc: BlockDoc,
  id: string,
  sub: BlockDoc,
): { doc: BlockDoc; lastId: string } | null {
  const parentId = findParentId(doc, id)
  if (parentId === undefined || sub.rootBlockIds.length === 0) return null
  const next = clone(doc)
  for (const [bid, block] of Object.entries(sub.blocks)) next.blocks[bid] = block

  const lastId = sub.rootBlockIds[sub.rootBlockIds.length - 1]
  const orphans = next.blocks[id]?.children ?? []
  if (orphans.length > 0) {
    const last = next.blocks[lastId]
    next.blocks[lastId] = { ...last, children: [...last.children, ...orphans] }
  }

  const list = [...siblingList(next, parentId)]
  list.splice(list.indexOf(id), 1, ...sub.rootBlockIds)
  if (parentId === null) next.rootBlockIds = list
  else next.blocks[parentId] = { ...next.blocks[parentId], children: list }
  delete next.blocks[id]

  return { doc: next, lastId }
}

function subtreeIds(doc: BlockDoc, id: string): string[] {
  const out: string[] = []
  const walk = (bid: string) => {
    out.push(bid)
    doc.blocks[bid]?.children.forEach(walk)
  }
  walk(id)
  return out
}

/** Remove a block and its subtree; returns a sensible block to focus next. */
export function removeBlock(doc: BlockDoc, id: string): { doc: BlockDoc; focusId: string | null } {
  const parentId = findParentId(doc, id)
  if (parentId === undefined) return { doc, focusId: null }
  const next = clone(doc)
  const list = [...siblingList(next, parentId)]
  const i = list.indexOf(id)
  const focusId = i > 0 ? list[i - 1] : parentId
  list.splice(i, 1)
  if (parentId === null) next.rootBlockIds = list
  else next.blocks[parentId] = { ...next.blocks[parentId], children: list }
  for (const removed of subtreeIds(doc, id)) delete next.blocks[removed]
  return { doc: next, focusId }
}

/** Indent a block: make it the last child of its previous sibling. */
export function indentBlock(doc: BlockDoc, id: string): BlockDoc {
  const parentId = findParentId(doc, id)
  if (parentId === undefined) return doc
  const list = siblingList(doc, parentId)
  const i = list.indexOf(id)
  if (i <= 0) return doc
  const prevId = list[i - 1]
  const next = clone(doc)
  const newList = [...list]
  newList.splice(i, 1)
  if (parentId === null) next.rootBlockIds = newList
  else next.blocks[parentId] = { ...next.blocks[parentId], children: newList }
  next.blocks[prevId] = { ...next.blocks[prevId], children: [...next.blocks[prevId].children, id] }
  return next
}

/** Reorder a block among its siblings, carrying its subtree with it. Returns
 * the doc unchanged when it's already at the end it's moving toward. */
export function moveBlock(doc: BlockDoc, id: string, direction: "up" | "down"): BlockDoc {
  const parentId = findParentId(doc, id)
  if (parentId === undefined) return doc
  const list = siblingList(doc, parentId)
  const i = list.indexOf(id)
  const j = direction === "up" ? i - 1 : i + 1
  if (j < 0 || j >= list.length) return doc
  const next = clone(doc)
  const newList = [...list]
  ;[newList[i], newList[j]] = [newList[j], newList[i]]
  if (parentId === null) next.rootBlockIds = newList
  else next.blocks[parentId] = { ...next.blocks[parentId], children: newList }
  return next
}

/** Outdent a block: make it a sibling of its parent, just after it. */
export function outdentBlock(doc: BlockDoc, id: string): BlockDoc {
  const parentId = findParentId(doc, id)
  if (parentId === undefined || parentId === null) return doc
  const grandParentId = findParentId(doc, parentId)
  if (grandParentId === undefined) return doc
  const next = clone(doc)
  next.blocks[parentId] = {
    ...next.blocks[parentId],
    children: next.blocks[parentId].children.filter((c) => c !== id),
  }
  const gList = [...siblingList(next, grandParentId)]
  gList.splice(gList.indexOf(parentId) + 1, 0, id)
  if (grandParentId === null) next.rootBlockIds = gList
  else next.blocks[grandParentId] = { ...next.blocks[grandParentId], children: gList }
  return next
}
