#!/usr/bin/env bash
set -euo pipefail
mkdir -p app/checkout components design/explorations/frosted-sleeve
cat > components/Button.tsx <<'TSX'
// SHARED-BUTTON-MARKER: used on every page.
export function Button(props: { children: React.ReactNode }) {
  return <button style={{ padding: 8, fontSize: 14 }}>{props.children}</button>;
}
TSX
cat > app/checkout/page.tsx <<'TSX'
import { Button } from "../../components/Button";
export default function Checkout() {
  return (
    <main style={{ background: "#F4F1EA", display: "grid", gridTemplateColumns: "repeat(12, 1fr)" }}>
      <p style={{ color: "#8A8F98", fontSize: 13 }}>Total</p>
      <h1 style={{ animation: "slide 2s infinite" }}>SAR 1,240</h1>
      <Button>Pay</Button>
    </main>
  );
}
TSX
cat > design/explorations/frosted-sleeve/DIRECTION.md <<'MD'
# Frosted sleeve
Applies only to: app/checkout. Platform: mobile.
Signature: sleeve card with a half-moon cutout for the total.
Layout: one column, 16px margins, 44pt targets, sticky pay button in thumb reach.
Motion: sleeve slides 200ms on confirm; still with reduced motion.
Avoid: text on frosted areas below 4.5:1.
MD
