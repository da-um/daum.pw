import { useEffect, useState } from 'react';

/** An account ID, copied on a click; says so for a moment. */
export function CopyId({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className="copy-id"
      aria-label={`复制${label} ${value}`}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => setCopied(true), () => {});
      }}
    >
      {label} <span aria-live="polite">{copied ? '已复制' : value}</span>
    </button>
  );
}
