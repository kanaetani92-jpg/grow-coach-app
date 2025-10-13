import { memo, useMemo } from "react";

type ListItem = {
  text: string;
  checked?: boolean;
};

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: ListItem[] };

function parseCoachingBlocks(content: string): Block[] {
  const lines = content.split(/\r?\n/);
  const blocks: Block[] = [];
  let currentList: { ordered: boolean; items: ListItem[] } | null = null;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      const text = paragraphBuffer.join("\n").trim();
      if (text) {
        blocks.push({ type: "paragraph", text });
      }
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (currentList && currentList.items.length > 0) {
      blocks.push({
        type: "list",
        ordered: currentList.ordered,
        items: currentList.items,
      });
    }
    currentList = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s*(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*•]\s+(.*)$/);
    const orderedMatch = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (unorderedMatch || orderedMatch) {
      flushParagraph();
      const ordered = Boolean(orderedMatch);
      const itemText = ordered ? orderedMatch![2] : unorderedMatch![1];
      const taskMatch = itemText.match(/^\[( |x|X)\]\s*(.*)$/);

      if (!currentList || currentList.ordered !== ordered) {
        flushList();
        currentList = { ordered, items: [] };
      }

      currentList.items.push({
        text: (taskMatch ? taskMatch[2] : itemText).trim(),
        checked: taskMatch ? taskMatch[1].toLowerCase() === "x" : undefined,
      });
      continue;
    }

    flushList();
    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function renderInline(text: string) {
  if (!text) {
    return text;
  }

  const elements: Array<string | JSX.Element> = [];
  const strongPattern = /(\*\*|__)(.+?)\1/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = strongPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }
    elements.push(<strong key={`${match.index}-${match[0].length}`}>{match[2]}</strong>);
    lastIndex = strongPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements.map((item, index) =>
    typeof item === "string" ? <span key={`text-${index}`}>{item}</span> : item,
  );
}

const CoachingMessage = memo(function CoachingMessage({ content }: { content: string }) {
  const blocks = useMemo(() => parseCoachingBlocks(content), [content]);

  if (blocks.length === 0) {
    return <p className="whitespace-pre-line">{content}</p>;
  }

  return (
    <div className="space-y-2 text-[15px] leading-relaxed">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <p key={`heading-${index}`} className="font-semibold text-slate-900">
              {renderInline(block.text)}
            </p>
          );
        }
        if (block.type === "paragraph") {
          return (
            <p key={`paragraph-${index}`} className="whitespace-pre-line">
              {renderInline(block.text)}
            </p>
          );
        }
        return block.ordered ? (
          <ol
            key={`ordered-${index}`}
            className="list-decimal space-y-1 pl-5 text-slate-900 marker:text-slate-500"
          >
            {block.items.map((item, itemIndex) => (
              <li key={`ordered-${index}-${itemIndex}`}>{renderInline(item.text)}</li>
            ))}
          </ol>
        ) : (
          <ul
            key={`unordered-${index}`}
            className="list-disc space-y-1 pl-5 text-slate-900 marker:text-slate-500"
          >
            {block.items.map((item, itemIndex) => {
              const hasCheckbox = typeof item.checked === "boolean";
              return hasCheckbox ? (
                <li key={`unordered-${index}-${itemIndex}`} className="list-none pl-0">
                  <span className="flex items-start gap-2 pl-[1.15rem]">
                    <span
                      className={`mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[11px] font-semibold ${
                        item.checked
                          ? "border-teal-600 bg-teal-600 text-white"
                          : "border-slate-400 text-transparent"
                      }`}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span className="flex-1">{renderInline(item.text)}</span>
                  </span>
                </li>
              ) : (
                <li key={`unordered-${index}-${itemIndex}`}>{renderInline(item.text)}</li>
              );
            })}
          </ul>
        );
      })}
    </div>
  );
});

CoachingMessage.displayName = "CoachingMessage";

export default CoachingMessage;
