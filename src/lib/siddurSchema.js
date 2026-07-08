/* ---------------- BUILD HIERARCHICAL TREE FROM SEFARIA SCHEMA ---------------- */
function buildTree(node, parentKeyPath, parentLabelPath) {
  const key = node.key || node.title;
  const fullKeyPath = parentKeyPath ? `${parentKeyPath}, ${key}` : key;
  const fullLabelPath = parentLabelPath
    ? `${parentLabelPath} > ${node.title}`
    : node.title;

  return {
    title: node.title,
    heTitle: node.heTitle,
    key,
    // Safely use Sefaria's native ref if it exists, otherwise fallback to our built path
    ref: node.ref || node.wholeRef || fullKeyPath,
    breadcrumb: fullLabelPath,
    children: (node.nodes || []).map((child) =>
      buildTree(child, fullKeyPath, fullLabelPath),
    ),
  };
}

/* ---------------- PROCESS SCHEMA: tree (for TOC) + flat leaves (for reader) ---------------- */
export function processSefariaSchema(schema) {
  const rootKey = schema.key || schema.title;
  const rootTitle = schema.title || rootKey;

  const tree = (schema.nodes || []).map((child) =>
    buildTree(child, rootKey, rootTitle),
  );

  const flat = [];
  const refToIndex = {};

  function collectLeaves(node) {
    if (node.children.length === 0) {
      refToIndex[node.ref] = flat.length;
      flat.push({
        label: node.title,
        heLabel: node.heTitle,
        breadcrumb: node.breadcrumb,
        ref: node.ref,
      });
    } else {
      node.children.forEach(collectLeaves);
    }
  }
  tree.forEach(collectLeaves);

  return { tree, flat, refToIndex };
}
