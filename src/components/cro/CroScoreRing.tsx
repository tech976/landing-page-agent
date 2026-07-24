import type { CroGrade } from "@/lib/cro/audit";

/**
 * The CRO score, drawn as a progress ring. Shared by the editor panel (lg), the editor
 * header pill (sm), and the dashboard cards (xs). Presentational and theme-safe: the band
 * colour uses app status tokens so it reads in light and dark.
 *
 * Band → colour: Excellent/Strong = success, Good = accent (indigo), Needs work = warning,
 * Weak = danger. The same thresholds as auditPage()'s gradeFor().
 */

const BAND: Record<CroGrade, { stroke: string; text: string }> = {
  Excellent: { stroke: "stroke-app-success", text: "text-app-success" },
  Strong: { stroke: "stroke-app-success", text: "text-app-success" },
  Good: { stroke: "stroke-app-accent", text: "text-app-accent" },
  "Needs work": { stroke: "stroke-app-warning", text: "text-app-warning" },
  Weak: { stroke: "stroke-app-danger", text: "text-app-danger" },
};

const SIZES = {
  xs: { px: 40, stroke: 4, font: "text-xs" },
  sm: { px: 30, stroke: 3.5, font: "text-[11px]" },
  lg: { px: 108, stroke: 9, font: "text-3xl" },
} as const;

export function CroScoreRing({
  score,
  grade,
  size = "lg",
  showValue = true,
  className,
}: {
  score: number;
  grade: CroGrade;
  size?: keyof typeof SIZES;
  showValue?: boolean;
  className?: string;
}) {
  const { px, stroke, font } = SIZES[size];
  const r = (px - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  const band = BAND[grade];

  return (
    <div
      className={`relative inline-grid shrink-0 place-items-center ${className ?? ""}`}
      style={{ width: px, height: px }}
    >
      <svg width={px} height={px} className="-rotate-90" aria-hidden>
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-app-border"
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className={band.stroke}
        />
      </svg>
      {showValue ? (
        <span
          className={`absolute font-heading font-extrabold tabular-nums ${font} ${band.text}`}
        >
          {score}
        </span>
      ) : null}
    </div>
  );
}
