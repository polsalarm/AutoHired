import { Link } from "react-router-dom";
import { Icon } from "./Icon";

export function TopAppBar() {
  return (
    <header className="sticky top-0 w-full z-50 bg-surface flex justify-between items-center h-16 px-container-margin">
      <Link
        to="/profile"
        className="w-8 h-8 rounded-full overflow-hidden bg-surface-container flex items-center justify-center shrink-0"
        aria-label="Profile"
      >
        <Icon name="person" size={20} className="text-on-surface-variant" />
      </Link>
      <Link to="/" className="text-headline-md font-bold text-primary">
        AutoHired
      </Link>
      <button
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors active:opacity-70"
        aria-label="Notifications"
      >
        <Icon name="notifications" className="text-primary" />
      </button>
    </header>
  );
}
