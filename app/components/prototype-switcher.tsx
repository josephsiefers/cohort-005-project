// PROTOTYPE tooling — floating bottom bar for flipping between UI variants.
// Never renders in production builds.

import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props<K extends string> {
  variants: readonly { key: K; name: string }[];
  current: K;
  onChange: (key: K) => void;
  /** Extra controls and state readout, shown to the right of the label. */
  children?: React.ReactNode;
}

export function PrototypeSwitcher<K extends string>({
  variants,
  current,
  onChange,
  children,
}: Props<K>) {
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current)
  );
  const go = (delta: number) =>
    onChange(variants[(index + delta + variants.length) % variants.length].key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.closest("input, textarea, select, [contenteditable]") ||
          t.isContentEditable)
      )
        return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-900 px-2 py-1.5 text-sm text-white shadow-2xl ring-1 ring-white/10">
      <button
        onClick={() => go(-1)}
        className="rounded-full p-1 hover:bg-white/10"
        title="Previous (←)"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-56 text-center font-medium">
        {variants[index].key}{" "}
        <span className="text-white/60">({variants[index].name})</span>
      </span>
      <button
        onClick={() => go(1)}
        className="rounded-full p-1 hover:bg-white/10"
        title="Next (→)"
      >
        <ChevronRight className="size-4" />
      </button>
      {children && (
        <div className="flex items-center gap-2 border-l border-white/20 pl-2 pr-1">
          {children}
        </div>
      )}
    </div>
  );
}
