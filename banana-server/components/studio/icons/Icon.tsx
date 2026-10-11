import type { JSX, SVGProps } from "react";

/**
 * Pixel icon wrapper (docs/design-language.md section 7). Glyphs come from Pixelarticons
 * (MIT, see THIRD_PARTY_NOTICES.md), drawn on a 24 by 24 grid in 2px pixel steps, filled with
 * currentColor. Icons are decoration: the control around them carries the accessible name.
 *
 * Sizes: 12 (chips, crisp at half size), 16 (buttons, menu slots, toasts), 24 (empty states).
 * Directional glyphs carry data-mirror and flip under :dir(rtl) (styles/studio-components.css).
 */
export type IconSize = 12 | 16 | 24;

export type IconProps = Omit<
  SVGProps<SVGSVGElement>,
  "width" | "height" | "children" | "aria-hidden" | "focusable" | "ref"
> & {
  /** Rendered size in CSS pixels. Default 16. */
  size?: IconSize;
};

export type Glyph = (props: SVGProps<SVGSVGElement>) => JSX.Element;

export type IconComponent = ((props: IconProps) => JSX.Element) & { displayName?: string };

export function createIcon(name: string, Glyph: Glyph, options: { mirror?: boolean } = {}): IconComponent {
  const Icon = ({ size = 16, className, ...rest }: IconProps) => (
    <Glyph
      {...rest}
      width={size}
      height={size}
      className={className ? `st-icon ${className}` : "st-icon"}
      aria-hidden="true"
      focusable="false"
      data-icon={name}
      data-mirror={options.mirror ? "" : undefined}
    />
  );
  Icon.displayName = `${name}Icon`;
  return Icon;
}
