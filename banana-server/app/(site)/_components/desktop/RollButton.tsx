/**
 * Rolling label: on hover the label rolls up and a copy rolls in from below (CSS only,
 * desktop.css, `cubic-bezier(.22,1,.36,1)` over 0.3s, off under prefers-reduced-motion). The copy
 * is aria-hidden, so the accessible name is the label once.
 */
import Link from "next/link";
import type { ReactNode } from "react";

export function RollLabel({ children }: { children: ReactNode }) {
  return (
    <span className="roll">
      <span className="roll-a">{children}</span>
      <span className="roll-b" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

type Props = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  className?: string;
  /** Next Link for same-site pages; plain <a> for hashes and other apps (the docs). */
  plain?: boolean;
};

export function RollButton({ href, children, variant = "secondary", size = "lg", icon, className, plain }: Props) {
  const cls = className ? `st-btn roll-btn ${className}` : "st-btn roll-btn";
  const body = (
    <>
      <RollLabel>{children}</RollLabel>
      {icon}
    </>
  );
  return plain || href.startsWith("#") ? (
    <a className={cls} data-variant={variant} data-size={size} href={href}>
      {body}
    </a>
  ) : (
    <Link className={cls} data-variant={variant} data-size={size} href={href}>
      {body}
    </Link>
  );
}
