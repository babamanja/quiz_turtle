import type { AdminTag } from "../../api/admin";

export type TagTreeNode = AdminTag & {
  children: TagTreeNode[];
};

export function buildTagTree(tags: AdminTag[]): TagTreeNode[] {
  const nodes = new Map<number, TagTreeNode>(
    tags.map((tag) => [tag.id, { ...tag, children: [] }]),
  );
  const roots: TagTreeNode[] = [];

  for (const tag of tags) {
    const node = nodes.get(tag.id);
    if (!node) {
      continue;
    }
    if (tag.parentId == null) {
      roots.push(node);
      continue;
    }
    const parent = nodes.get(tag.parentId);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (items: TagTreeNode[]) => {
    items.sort((left, right) => left.name.localeCompare(right.name));
    for (const item of items) {
      sortNodes(item.children);
    }
  };
  sortNodes(roots);

  return roots;
}

export function getAncestorTagIds(tagId: number, tags: AdminTag[]): number[] {
  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  const ancestors: number[] = [];
  let current = byId.get(tagId);

  while (current?.parentId != null) {
    ancestors.push(current.parentId);
    current = byId.get(current.parentId);
  }

  return ancestors;
}

export function getDescendantTagIds(tagId: number, tags: AdminTag[]): number[] {
  const descendants: number[] = [];
  const queue = [tagId];

  while (queue.length > 0) {
    const parentId = queue.pop();
    if (parentId == null) {
      continue;
    }
    for (const tag of tags) {
      if (tag.parentId === parentId && !descendants.includes(tag.id)) {
        descendants.push(tag.id);
        queue.push(tag.id);
      }
    }
  }

  return descendants;
}

export function expandTagIdsWithAncestors(tagIds: number[], tags: AdminTag[]): number[] {
  const expanded = new Set(tagIds);
  for (const tagId of tagIds) {
    for (const ancestorId of getAncestorTagIds(tagId, tags)) {
      expanded.add(ancestorId);
    }
  }
  return [...expanded];
}

export function toggleTagSelection(
  tagId: number,
  selectedTagIds: number[],
  tags: AdminTag[],
): number[] {
  if (selectedTagIds.includes(tagId)) {
    const toRemove = new Set([tagId, ...getDescendantTagIds(tagId, tags)]);
    return selectedTagIds.filter((id) => !toRemove.has(id));
  }

  return [...new Set([...selectedTagIds, tagId, ...getAncestorTagIds(tagId, tags)])];
}
