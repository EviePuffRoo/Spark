import { useState } from "react";

// A one-click copy affordance for codes the user is told to save (recovery
// codes, world invite codes) — those are exactly the moments a fiddly manual
// select-and-copy is most likely to go wrong.
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API can be unavailable (insecure context, permissions) —
      // fall back to a hidden textarea + execCommand rather than failing silently.
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand("copy"); } catch { /* give up quietly */ }
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className="btn-secondary copy-button" onClick={handleCopy}>
      {copied ? "Copied!" : label}
    </button>
  );
}
