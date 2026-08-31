import {
  renderSentenceTokens,
  type AdaptiveStoryTokenInput,
} from "@language-turtle/shared";

type StoryReaderProps = {
  sentences: Array<{
    id?: number;
    sortOrder: number;
    tokens: AdaptiveStoryTokenInput[];
  }>;
  unlockedWordIds: ReadonlySet<number> | readonly number[];
  className?: string;
};

export default function StoryReader({
  sentences,
  unlockedWordIds,
  className,
}: StoryReaderProps) {
  const sorted = [...sentences].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className={["story-reader", className].filter(Boolean).join(" ")}>
      {sorted.map((sentence, index) => {
        const { parts } = renderSentenceTokens(sentence.tokens, unlockedWordIds);
        const key = sentence.id ?? `sentence-${sentence.sortOrder}-${index}`;
        return (
          <p key={key} className="story-reader__sentence">
            {parts.map((part, partIndex) => {
              const prev = parts[partIndex - 1];
              const glue =
                partIndex > 0 &&
                part.glueToPrevious &&
                part.unlocked &&
                (prev?.unlocked ?? false);
              return (
                <span
                  key={`${key}-part-${partIndex}`}
                  className={[
                    "story-reader__token",
                    part.unlocked
                      ? "story-reader__token--unlocked"
                      : "story-reader__token--locked",
                    glue ? "story-reader__token--glue" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {part.text}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
