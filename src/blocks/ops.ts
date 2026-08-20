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
