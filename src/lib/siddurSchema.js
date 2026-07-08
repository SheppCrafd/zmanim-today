/* ---------------- BUILD HIERARCHICAL TREE FROM SEFARIA SCHEMA ---------------- */
// Sefaria sometimes embeds a foreign-language gloss in parentheses inside a
// node's English title (e.g. "Tikun Rachel (Correção de Raquel)"). Strip those
// parenthetical subtitles from DISPLAY titles; raw refs/keys stay untouched.
const cleanTitle = (t) => (t || "").replace(/\s*\([^)]*\)\s*/g, "").trim();

function buildTree(node, parentKeyPath, parentLabelPath) {
  const key = node.key || node.title;
  const fullKeyPath = parentKeyPath ? `${parentKeyPath}, ${key}` : key;
  const displayTitle = cleanTitle(node.title);
  const fullLabelPath = parentLabelPath
    ? `${parentLabelPath} > ${displayTitle}`
    : displayTitle;

  // Siddur leaves are often references to other Sefaria texts rather than
  // stored sub-texts (e.g. an "Ashrei" node → "Psalm 145"; a "Psalm 146" node
  // → the biblical "Psalm 146"). The leaf's own path 404s for these, so collect
  // every English title (non-primary first, then primary) as fallback refs.
  const altRefs = Array.isArray(node.titles)
    ? node.titles
        .filter((t) => t && t.text && t.lang === "en")
        .sort((a, b) => (a.primary ? 1 : 0) - (b.primary ? 1 : 0))
        .map((t) => t.text)
    : [];

  return {
    title: displayTitle,
    heTitle: node.heTitle,
    key,
    // Safely use Sefaria's native ref if it exists, otherwise fallback to our built path
    ref: node.ref || node.wholeRef || fullKeyPath,
    breadcrumb: fullLabelPath,
    altRefs,
    children: (node.nodes || []).map((child) =>
      buildTree(child, fullKeyPath, fullLabelPath),
    ),
  };
}

/* ---------------- PROCESS SCHEMA: tree (for TOC) + flat leaves (for reader) ---------------- */
export function processSefariaSchema(schema) {
  const rootKey = schema.key || schema.title;
  const rootTitle = cleanTitle(schema.title || rootKey);

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
        altRefs: node.altRefs,
      });
    } else {
      node.children.forEach(collectLeaves);
    }
  }
  tree.forEach(collectLeaves);

  return { tree, flat, refToIndex };
}