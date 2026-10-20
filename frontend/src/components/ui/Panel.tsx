"use client";

import type { ReactNode } from "react";

/**
 * The one panel primitive used everywhere in the workbench: a white surface
 * with a hairline border and an optional 44px header bar.
 */
export default function Panel({
  title,
  eyebrow,
  icon,
  actions,
  children,
  bodyClassName = "",
  className = "",
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <section className={`surface overflow-hidden shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="panel-bar">
          <div className="min-w-0">
            {eyebrow && <div className="panel-eyebrow">{eyebrow}</div>}
            {title && (
              <h2 className="panel-title mt-0.5 truncate">
                {icon}
                {title}
              </h2>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
