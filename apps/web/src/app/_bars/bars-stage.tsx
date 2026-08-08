import type { ElementType, ReactNode } from "react";

import { Bars } from "@/app/_bars/bars";

// The container half of the effect. <Bars /> is position: absolute / inset: 0
// and contributes nothing to flow, so it needs a positioned box with a real
// height to fill -- pairing the two here is what stops every caller from
// re-deriving that. The box's height is the caller's: either the section this
// wraps has content that gives it one, or the caller's own class sets it.
//
// `as` exists because the stage usually IS the section rather than a div inside
// it. Wrapping a <header>'s children instead would put the bars inside its
// padding box and leave the padding bare.
export function BarsStage({
  as: Tag = "div" as ElementType,
  children,
  className,
}: {
  as?: ElementType;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Tag className={className ? `bars-stage ${className}` : "bars-stage"}>
      <Bars />
      <div className="bars-stage__content">{children}</div>
    </Tag>
  );
}
