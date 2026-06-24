import { NavLink } from "react-router-dom";
import { Icon } from "./Icon";

const tabs = [
  { to: "/", icon: "home", label: "Home" },
  { to: "/tasks", icon: "checklist", label: "Tasks" },
  { to: "/vault", icon: "inventory_2", label: "Vault" },
  { to: "/profile", icon: "person", label: "Profile" },
];

export function BottomNavBar() {
  return (
    <nav className="fixed bottom-0 w-full z-50 bg-surface border-t border-outline-variant shadow-lg flex justify-around items-center h-16 px-container-margin pb-safe">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === "/"}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 h-full pt-2 rounded-lg transition-colors hover:bg-surface-container-low scale-95 active:scale-90 ${
              isActive
                ? "text-primary font-bold relative after:content-[''] after:absolute after:top-0 after:w-8 after:h-1 after:bg-primary after:rounded-full"
                : "text-on-surface-variant"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon name={tab.icon} fill={isActive} />
              <span className="text-label-sm mt-1">{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
