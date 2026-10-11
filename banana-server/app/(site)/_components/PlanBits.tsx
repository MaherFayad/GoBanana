/**
 * Plan card parts shared by the landing pricing section and the pricing page: the feature list
 * with an icon per line (what the line is about, not a check mark for everything; a missing
 * feature gets a minus), and the "Beta: Pro for everyone" badge. Icons are decoration; the words
 * carry the meaning (SC 1.4.1).
 */
import type { ReactNode } from "react";
import { CanvasesIcon, FileIcon, ImageIcon, MinusIcon, SearchIcon, ShareIcon, SparkleIcon, type IconComponent } from "@/components/studio/icons";
import type { PlanFeatureKey } from "@/lib/site/plans";
import { bidi } from "./Bidi";

const ICONS: Record<PlanFeatureKey, IconComponent> = {
  searches: SearchIcon,
  canvases: CanvasesIcon,
  items: ImageIcon,
  share: ShareIcon,
  noShare: MinusIcon,
  exports: FileIcon,
};

export function PlanFeatureList({ items }: { items: { key: PlanFeatureKey; text: string }[] }) {
  return (
    <ul className="feature-list has-icons">
      {items.map((f) => {
        const Icon = ICONS[f.key];
        return (
          <li key={f.key} data-feature={f.key}>
            <span className="feature-icon">
              <Icon size={16} />
            </span>
            <span>{bidi(f.text)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function BetaBadge({ children }: { children: ReactNode }) {
  return (
    <span className="beta-badge">
      <SparkleIcon size={16} />
      <span>{children}</span>
    </span>
  );
}
