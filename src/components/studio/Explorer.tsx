"use client";

import { useState } from "react";
import { ChevronRight, FilePlus2, Trash2, RotateCcw } from "lucide-react";
import { buildTree, useWorkspace, type TreeNode } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export function Explorer() {
  const files = useWorkspace((s) => s.files);
  const activePath = useWorkspace((s) => s.activePath);
  const open = useWorkspace((s) => s.open);
  const create = useWorkspace((s) => s.create);
  const remove = useWorkspace((s) => s.remove);
  const reset = useWorkspace((s) => s.reset);
  const tree = buildTree(files);

  const addFile = () => {
    const path = window.prompt("New file path", "src/untitled.ts")?.trim();
    if (path) create(path);
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Explorer">
        <IconBtn label="New file" onClick={addFile}>
          <FilePlus2 size={13} />
        </IconBtn>
        <IconBtn
          label="Reset workspace"
          onClick={() => {
            if (window.confirm("Discard all files and seals in this browser?")) {
              reset();
            }
          }}
        >
          <RotateCcw size={13} />
        </IconBtn>
      </PanelHeader>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {tree.map((node) => (
          <Node
            key={node.path}
            node={node}
            depth={0}
            activePath={activePath}
            onOpen={open}
            onRemove={remove}
          />
        ))}
      </div>
    </div>
  );
}

function Node({
  node,
  depth,
  activePath,
  onOpen,
  onRemove,
}: {
  node: TreeNode;
  depth: number;
  activePath: string;
  onOpen: (p: string) => void;
  onRemove: (p: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isDir = Boolean(node.children);
  const isActive = node.path === activePath;

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-1 pr-1 text-[12.5px] transition-colors duration-100",
          isActive ? "bg-brass/10 text-paper" : "text-muted hover:bg-raised",
        )}
        style={{ paddingLeft: depth * 12 + 8 }}
      >
        <button
          type="button"
          onClick={() => (isDir ? setExpanded((v) => !v) : onOpen(node.path))}
          className="flex min-w-0 flex-1 items-center gap-1 py-[5px] text-left"
        >
          {isDir ? (
            <ChevronRight
              size={13}
              className={cn(
                "shrink-0 text-faint transition-transform duration-150",
                expanded && "rotate-90",
              )}
            />
          ) : (
            <span className="w-[13px] shrink-0" />
          )}
          <span className={cn("truncate font-mono", isActive && "text-brass")}>
            {node.name}
          </span>
        </button>
        {!isDir && (
          <button
            type="button"
            aria-label={`Delete ${node.path}`}
            onClick={() => onRemove(node.path)}
            className="hidden shrink-0 rounded-[4px] p-1 text-faint hover:text-oxide group-hover:block"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      {isDir &&
        expanded &&
        node.children?.map((c) => (
          <Node
            key={c.path}
            node={c}
            depth={depth + 1}
            activePath={activePath}
            onOpen={onOpen}
            onRemove={onRemove}
          />
        ))}
    </>
  );
}

export function PanelHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-line px-3">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.11em] text-faint">
        {title}
      </span>
      <div className="ml-auto flex items-center gap-0.5">{children}</div>
    </div>
  );
}

export function IconBtn({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid size-6 place-items-center rounded-[4px] transition-colors duration-150",
        active ? "text-brass" : "text-faint hover:bg-raised hover:text-paper",
      )}
    >
      {children}
    </button>
  );
}
