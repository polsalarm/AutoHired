/**
 * Deterministic gradient avatar — derives a stable hue from the label so every
 * company/person gets a consistent, vivid identity instead of a flat letter box.
 */
function hueFrom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = seed.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h) % 360;
}

function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

interface AvatarProps {
  label: string;
  size?: number;
  rounded?: string;
  className?: string;
}

export function Avatar({
  label,
  size = 48,
  rounded = "rounded-xl",
  className = "",
}: AvatarProps) {
  const hue = hueFrom(label || "?");
  const bg = `linear-gradient(135deg, hsl(${hue} 72% 56%), hsl(${(hue + 38) % 360} 70% 44%))`;
  return (
    <div
      className={`${rounded} flex items-center justify-center text-white font-bold shrink-0 shadow-level-1 ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.4,
      }}
      aria-hidden="true"
    >
      {initials(label)}
    </div>
  );
}
