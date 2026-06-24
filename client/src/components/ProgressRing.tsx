interface ProgressRingProps {
  /** Percentage 0–100 */
  value: number;
  /** Outer pixel size of the ring */
  size?: number;
  trackClass?: string;
  barClass?: string;
  labelClass?: string;
  showLabel?: boolean;
}

const CIRCUMFERENCE = 2 * Math.PI * 40; // r=40 in 100x100 viewBox

export function ProgressRing({
  value,
  size = 48,
  trackClass = "text-primary-container",
  barClass = "text-primary",
  labelClass = "text-label-sm text-on-surface font-bold",
  showLabel = true,
}: ProgressRingProps) {
  const offset = CIRCUMFERENCE * (1 - value / 100);
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg className="w-full h-full" viewBox="0 0 100 100">
        <circle
          className={`${trackClass} stroke-current`}
          cx="50"
          cy="50"
          r="40"
          fill="transparent"
          strokeWidth="8"
        />
        <circle
          className={`${barClass} progress-ring__circle stroke-current`}
          cx="50"
          cy="50"
          r="40"
          fill="transparent"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      {showLabel && <span className={`absolute ${labelClass}`}>{value}</span>}
    </div>
  );
}
