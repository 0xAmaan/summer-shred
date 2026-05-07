// Lightweight markdown renderer — handles headings, paragraphs, fenced code,
// inline bold/italic/code, and unordered lists. No dependency.

import * as React from "react";

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; text: string }
  | { type: "hr" };

function tokenizeBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: "code", text: buf.join("\n") });
      continue;
    }
    if (/^---+\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3;
      const type = (`h${level}`) as "h1" | "h2" | "h3";
      blocks.push({ type, text: heading[2] });
      i++;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    // Paragraph: gather consecutive non-empty lines
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ type: "p", text: buf.join(" ") });
  }
  return blocks;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const codeRegex = /`([^`]+)`/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let counter = 0;
  while ((m = codeRegex.exec(text))) {
    if (m.index > lastIndex) {
      parts.push(...renderBoldItalic(text.slice(lastIndex, m.index), `${keyPrefix}-t${counter}`));
    }
    parts.push(
      <code
        key={`${keyPrefix}-c${counter}`}
        className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono"
      >
        {m[1]}
      </code>
    );
    lastIndex = m.index + m[0].length;
    counter++;
  }
  if (lastIndex < text.length) {
    parts.push(...renderBoldItalic(text.slice(lastIndex), `${keyPrefix}-t${counter}`));
  }
  return parts;
}

function renderBoldItalic(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let remaining = text;
  let i = 0;
  while (remaining.length > 0) {
    const bold = /^\*\*([^*]+)\*\*/.exec(remaining);
    if (bold) {
      out.push(<strong key={`${keyPrefix}-b${i++}`}>{bold[1]}</strong>);
      remaining = remaining.slice(bold[0].length);
      continue;
    }
    const italic = /^[*_]([^*_]+)[*_]/.exec(remaining);
    if (italic) {
      out.push(<em key={`${keyPrefix}-i${i++}`}>{italic[1]}</em>);
      remaining = remaining.slice(italic[0].length);
      continue;
    }
    const next = remaining.search(/(\*\*|[*_])/);
    if (next === -1) {
      out.push(<React.Fragment key={`${keyPrefix}-x${i++}`}>{remaining}</React.Fragment>);
      break;
    }
    if (next > 0) {
      out.push(
        <React.Fragment key={`${keyPrefix}-x${i++}`}>
          {remaining.slice(0, next)}
        </React.Fragment>
      );
      remaining = remaining.slice(next);
    } else {
      out.push(
        <React.Fragment key={`${keyPrefix}-x${i++}`}>{remaining[0]}</React.Fragment>
      );
      remaining = remaining.slice(1);
    }
  }
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = React.useMemo(() => tokenizeBlocks(source), [source]);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h1":
            return (
              <h2 key={i} className="text-xl font-semibold tracking-tight mt-2 mb-3">
                {renderInline(b.text, `b${i}`)}
              </h2>
            );
          case "h2":
            return (
              <h3 key={i} className="text-base font-semibold mt-4 mb-2">
                {renderInline(b.text, `b${i}`)}
              </h3>
            );
          case "h3":
            return (
              <h4 key={i} className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-3 mb-1.5">
                {renderInline(b.text, `b${i}`)}
              </h4>
            );
          case "p":
            return (
              <p key={i} className="text-sm leading-relaxed text-foreground/90 mb-2.5">
                {renderInline(b.text, `b${i}`)}
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="text-sm leading-relaxed list-disc pl-5 mb-2.5 space-y-1">
                {b.items.map((it, j) => (
                  <li key={j} className="text-foreground/90">
                    {renderInline(it, `b${i}-${j}`)}
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="text-sm leading-relaxed list-decimal pl-5 mb-2.5 space-y-1">
                {b.items.map((it, j) => (
                  <li key={j} className="text-foreground/90">
                    {renderInline(it, `b${i}-${j}`)}
                  </li>
                ))}
              </ol>
            );
          case "code":
            return (
              <pre
                key={i}
                className="bg-muted rounded-md px-3 py-2 text-xs font-mono whitespace-pre-wrap mb-2.5 overflow-x-auto"
              >
                {b.text}
              </pre>
            );
          case "hr":
            return <hr key={i} className="my-3 border-border" />;
        }
      })}
    </div>
  );
}
