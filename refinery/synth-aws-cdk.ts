import { Construct } from "constructs";
import type { RefinerySpec } from "./generated/spec.js";

export interface RefineryProps {
  spec: RefinerySpec;
}

export class Refinery extends Construct {
  constructor(scope: Construct, id: string, props: RefineryProps) {
    super(scope, id);
  }
}
