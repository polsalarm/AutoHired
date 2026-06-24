interface IconProps {
  name: string;
  fill?: boolean;
  size?: number;
  className?: string;
}

/** Material Symbols Outlined icon. */
export function Icon({ name, fill = false, size = 24, className = "" }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined select-none ${fill ? "icon-fill" : ""} ${className}`}
      style={{ fontSize: size }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
