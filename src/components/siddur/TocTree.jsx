import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/* ---------------- RECURSIVE NODE (collapsible dropdown for all sub-levels) ---------------- */
function TocNode({ node, onSelect, refToIndex, depth }) {
  const [open, setOpen] = useState(false);
  const isLeaf = node.children.length === 0;

  const indent = { paddingLeft: `${depth * 1.25 + 0.5}rem` };

  if (isLeaf) {
    const index = refToIndex[node.ref];
    return (
      <button
        onClick={() => onSelect(index)}
        className="w-full text-left py-2.5 pr-2 border-b border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-sm transition-colors text-sm"
        style={indent}
      >
        {node.title}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-2.5 pr-2 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        style={indent}
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        )}
        <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
          {node.title}
        </span>
      </button>
      {open && (
        <div className="border-l border-slate-200 dark:border-slate-700 ml-[0.625rem]">
          {node.children.map((child, i) => (
            <TocNode
              key={i}
              node={child}
              onSelect={onSelect}
              refToIndex={refToIndex}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- TOC TREE: top level always visible, everything below collapsible ---------------- */
export default function TocTree({ nodes, onSelect, refToIndex }) {
  return (
    <div className="flex flex-col">
      {nodes.map((node, i) => {
        // Top-level leaf — directly clickable header
        if (node.children.length === 0) {
          const index = refToIndex[node.ref];
          return (
            <div key={i} className="mb-4">
              <button
                onClick={() => onSelect(index)}
                className="w-full text-left font-semibold text-slate-700 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 shadow-sm px-2 py-2.5 -mx-4 sticky top-0 z-10 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {node.title}
              </button>
            </div>
          );
        }

        // Top-level category — always-visible header, children in dropdowns
        return (
          <div key={i} className="mb-6">
            <h2 className="font-semibold text-slate-700 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 shadow-sm px-2 py-2 -mx-4 sticky top-0 z-10 mb-2">
              {node.title}
            </h2>
            <div className="flex flex-col">
              {node.children.map((child, j) => (
                <TocNode
                  key={j}
                  node={child}
                  onSelect={onSelect}
                  refToIndex={refToIndex}
                  depth={0}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}