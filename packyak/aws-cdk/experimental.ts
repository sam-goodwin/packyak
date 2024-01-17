import { type App, Stack } from "aws-cdk-lib/core";
import type { Construct } from "constructs";
import { isPromise } from "util/types";

type ConstructInstance<
  F extends (this: InstanceType<Base>, props?: any) => any,
  Base extends new (
    scope: Construct,
    id: string,
    props?: any
  ) => any = typeof Construct
> = {
  construct: InstanceType<Base> & Awaited<ReturnType<F>>;
} & (undefined extends Parameters<F>[0]
  ? {
      new (scope: Construct, id: string): InstanceType<Base> & ReturnType<F>;
    }
  : Parameters<F>[0] extends undefined
  ? {
      new (
        scope: Construct,
        id: string,
        props?: Parameters<F>[0]
      ): InstanceType<Base> & ReturnType<F>;
    }
  : {
      new (
        scope: Construct,
        id: string,
        props: Parameters<F>[0]
      ): InstanceType<Base> & ReturnType<F>;
    });

export function stack<F extends (this: Stack, props?: any) => any>(
  func: F
): ConstructInstance<F, typeof Stack> {
  return construct(func, Stack);
}

export function construct<
  F extends (this: InstanceType<Base>, props?: any) => any,
  Base extends new (
    scope: Construct,
    id: string,
    props?: any
  ) => any = typeof Construct
>(
  func: F,
  // @ts-ignore
  base: Base = Construct
): ConstructInstance<F, Base> {
  // @ts-ignore
  return class extends base {
    static construct: any;
    constructor(scope: App, id: string, props?: any) {
      super(scope, id);
      // @ts-expect-error - we are being naughty and we know it
      const result = func.bind(this)(props);

      if (isPromise(result)) {
        // @ts-ignore
        return result.then((outputs: any) => {
          Object.assign(this, outputs);
          return this;
        });
      } else {
        Object.assign(this, result);
      }
    }
  };
}

declare module "constructs" {
  interface Construct {
    create<F extends (this: Stack) => any>(id: string, func: F): ReturnType<F>;
    create<F extends (this: Construct) => any>(
      id: string,
      func: F
    ): ReturnType<F>;
    create<F extends (this: Stack) => any>(func: F): ReturnType<F>;
    create<F extends (this: Construct) => any>(func: F): ReturnType<F>;
  }
}
