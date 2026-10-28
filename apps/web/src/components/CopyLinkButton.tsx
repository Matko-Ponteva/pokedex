import { useEffect, useState } from "react";

export function CopyLinkButton({ shareId }: { shareId: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    const url = `${window.location.origin}/t/${shareId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <button type="button" className="secondary" onClick={copy}>
      <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
    </button>
  );
}