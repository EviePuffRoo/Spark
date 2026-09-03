import { Fragment, useEffect, useRef, useState } from "react";
import { RULES_GLOSSARY } from "@spark/shared";

const GLOSSARY_BY_LOWER = new Map(RULES_GLOSSARY.map((e) => [e.term.toLowerCase(), e]));

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Longest term first, so a multi-word phrase matches whole rather than a
// shorter phrase inside it grabbing part of the match.
const TERM_PATTERN = new RegExp(
  `\\b(${[...RULES_GLOSSARY].sort((a, b) => b.term.length - a.term.length).map((e) => escapeRegExp(e.term)).join("|")})\\b`,
  "gi",
);

// Wraps every word in `text` that matches shared/src/rulesGlossary.ts (D&D
// conditions, a couple of distinctive rules phrases) in a clickable term
// that reveals its definition on click, without navigating away from
// whatever stat block, spell, or lair action the text lives in.
export function RulesLinkedText({ text }: { text: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (openIndex === null) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpenIndex(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openIndex]);

  // String.split with a single-capturing-group regex alternates
  // [plain, match, plain, match, ...] — odd indices are always matches.
  const parts = text.split(TERM_PATTERN);

  return (
    <span ref={containerRef}>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const entry = GLOSSARY_BY_LOWER.get(part.toLowerCase());
        if (!entry) return <Fragment key={i}>{part}</Fragment>;
        return (
          <span key={i} className="rules-term">
            <button type="button" className="rules-term-trigger" onClick={() => setOpenIndex(openIndex === i ? null : i)}>
              {part}
            </button>
            {openIndex === i && (
              <span className="rules-term-popover" role="tooltip">
                <strong>{entry.term}.</strong> {entry.description}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
