"use client";

import type { NodeProps } from "@xyflow/react";
import { useCanvasActions } from "../context";
import { findPairing, fontStack, nextPairingId } from "../fonts";
import type { TypeSampleFlowNode } from "../types";
import { NodeMenu } from "./NodeMenu";
import { Resizer } from "./Resizer";

export function TypeSampleNode({ id, data, selected, parentId }: NodeProps<TypeSampleFlowNode>) {
  const actions = useCanvasActions();
  const pairing = findPairing(data.pairingId);
  const sample = data.sample || pairing?.sample || "The quick brown fox";

  const items = [
    {
      label: "Swap font pairing",
      onSelect: () => {
        const next = nextPairingId(data.pairingId);
        actions.updateData<"typeSample">(id, { pairingId: next });
        actions.announce(`Font pairing is now ${findPairing(next)?.name ?? next}`);
      },
    },
  ];

  return (
    <>
      <Resizer type="typeSample" selected={selected} />
      <div className="bn-node bn-type">
      {/* React 19 hoists this stylesheet into <head>. Off when the host blocks font CSS. */}
      {actions.loadFonts && pairing?.url && <link rel="stylesheet" href={pairing.url} precedence="default" />}
      <p className="bn-type-name">{pairing?.name ?? data.pairingId}</p>
      <p
        className="bn-type-display"
        style={pairing ? { fontFamily: fontStack(pairing.display), fontWeight: pairing.display.weight } : undefined}
      >
        {sample}
      </p>
      <p
        className="bn-type-body"
        style={pairing ? { fontFamily: fontStack(pairing.body), fontWeight: pairing.body.weight } : undefined}
      >
        Body text sits here so you can judge the pair together.
      </p>
      <div className="bn-node-bar">
        <span className="bn-grow" />
        <NodeMenu nodeId={id} label="type sample" parentId={parentId} items={items} />
      </div>
    </div>
    </>
  );
}
