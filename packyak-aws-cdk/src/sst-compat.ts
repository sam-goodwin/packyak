// TODO: SST compat

import { Node } from "constructs";
import type { App } from "sst/constructs";

declare module "constructs" {
  interface ConstructNode {
    root: App;
  }
}
Object.defineProperty(Node.prototype, "root", {
  get() {
    throw new Error("WOOF");
    return this.scope.root;
  },
});
