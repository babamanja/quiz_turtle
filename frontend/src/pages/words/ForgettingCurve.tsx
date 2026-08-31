import { useTranslation } from "react-i18next";

import {
  currentRetention,
  retentionAtElapsed,
  reviewRetentionThresholdForLevel,
} from "@language-turtle/shared";
import { joinClassNames } from "../../components/UI/joinClassNames";
import { formatShortDurationMs } from "../../utils/convertTime";

type ForgettingCurveProps = {
  pimsleurLevel: number;
  nextReviewMs: number;
  nowMs?: number;
  compact?: boolean;
};

const WIDTH = 520;
const HEIGHT = 180;
const COMPACT_HEIGHT = 120;
const PAD = { top: 14, right: 12, bottom: 32, left: 40 };

export default function ForgettingCurve({
  pimsleurLevel,
  nextReviewMs,
  nowMs = Date.now(),
  compact = false,
}: ForgettingCurveProps) {
  const { t } = useTranslation();
  const state = currentRetention(pimsleurLevel, nextReviewMs, nowMs);
  const height = compact ? COMPACT_HEIGHT : HEIGHT;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const threshold = reviewRetentionThresholdForLevel(state.level);

  const points: Array<{ x: number; y: number }> = [];
  const steps = 24;
  for (let i = 0; i <= steps; i += 1) {
    const progress = i / steps;
    const retention = retentionAtElapsed(progress * state.intervalMs, state.intervalMs, threshold);
    points.push({
      x: PAD.left + progress * plotW,
      y: PAD.top + (1 - retention) * plotH,
    });
  }

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const nowX = PAD.left + state.progress * plotW;
  const nowY = PAD.top + (1 - state.retention) * plotH;
  const endY = PAD.top + (1 - threshold) * plotH;

  return (
    <figure
      className={joinClassNames("forgetting-curve", compact && "forgetting-curve--compact")}
      aria-label={t("wordDetailPage.forgettingCurve.ariaLabel")}
    >
      <svg
        className="forgetting-curve__chart"
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
      >
        <line
          className="forgetting-curve__axis"
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={PAD.top + plotH}
        />
        <line
          className="forgetting-curve__axis"
          x1={PAD.left}
          y1={PAD.top + plotH}
          x2={PAD.left + plotW}
          y2={PAD.top + plotH}
        />
        <text className="forgetting-curve__axis-label forgetting-curve__axis-label--x" x={PAD.left} y={height - 8}>
          {t("wordDetailPage.forgettingCurve.lastReview")}
        </text>
        <text
          className="forgetting-curve__axis-label forgetting-curve__axis-label--x"
          x={PAD.left + plotW}
          y={height - 8}
          textAnchor="end"
        >
          {formatShortDurationMs(state.intervalMs)}
        </text>
        <path className="forgetting-curve__line" d={line} />
        <line className="forgetting-curve__now-line" x1={nowX} y1={PAD.top} x2={nowX} y2={PAD.top + plotH} />
        <circle className="forgetting-curve__logo-marker" cx={nowX} cy={nowY} r="5" />
        <circle cx={PAD.left} cy={PAD.top} r="3" fill="var(--forgetting-curve-marker-start)" />
        <circle cx={PAD.left + plotW} cy={endY} r="3" fill="var(--forgetting-curve-marker-end)" />
      </svg>
      {state.isOverdue ? (
        <p className="forgetting-curve__overdue">{t("wordDetailPage.forgettingCurve.overdue")}</p>
      ) : null}
    </figure>
  );
}
