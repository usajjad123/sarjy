import type { ReactNode } from "react";
import type { DashboardView } from "../types";

const headings = {
  today: {
    title: "Your day, at a glance.",
    description: "Every meal counts. Every detail is yours to change.",
  },
  library: {
    title: "Familiar food. Less effort.",
    description: "Verified foods and usual meals, ready for next time.",
  },
  memory: {
    title: "The little things you tell us.",
    description: "Preferences that stay with you, without signing up.",
  },
} satisfies Record<DashboardView, { title: string; description: string }>;

export function DashboardHeading({
  view,
  children,
}: {
  view: DashboardView;
  children?: ReactNode;
}) {
  const heading = headings[view];
  return (
    <div className="page-heading">
      <div>
        <p className="fit-eyebrow">A LITTLE LESS FRICTION</p>
        <h1>{heading.title}</h1>
        <p>{heading.description}</p>
      </div>
      {children}
    </div>
  );
}
