import Link from "next/link";
import { Icon } from "./icon";
import type { DashboardView } from "../types";
const views = [
  { id: "today", name: "Daily dashboard", icon: "grid" },
  { id: "library", name: "Food & meal library", icon: "heart" },
  { id: "memory", name: "Personal memory", icon: "leaf" },
] as const;
export function DashboardNavigation({
  view,
  onChange,
}: {
  view: DashboardView;
  onChange: (view: DashboardView) => void;
}) {
  return (
    <nav className="fit-rail" aria-label="Main navigation">
      <Link className="fit-logo" href="/" aria-label="Sarjy Fit home">
        s<span>✳</span>
      </Link>
      <div className="rail-links">
        {views.map((item) => (
          <button
            key={item.id}
            title={item.name}
            aria-label={item.name}
            aria-current={view === item.id ? "page" : undefined}
            className={view === item.id ? "selected" : ""}
            onClick={() => onChange(item.id)}
          >
            <Icon name={item.icon} />
          </button>
        ))}
      </div>
      <div className="rail-bottom">
        <span className="guest-monogram">Y</span>
        <small>Just you</small>
      </div>
    </nav>
  );
}
