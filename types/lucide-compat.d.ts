import type { SVGProps } from "react";

// lucide-react 0.468 references a React alias removed from React 19's types.
declare module "react" {
  export type ReactSVG = SVGProps<SVGSVGElement>;
}
