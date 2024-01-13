export interface PackyakSpec {
  buckets: BucketSpec[];
  queues: QueueSpec[];
  functions: FunctionSpec[];
}
export interface FunctionSpec extends PythonPoetryArgs {
  with: DependencyGroup | undefined;
  without: DependencyGroup | undefined;
  dev: boolean | undefined;
  all_extras: boolean | undefined;
  without_hashes: boolean | undefined;
  without_urls: boolean | undefined;
  function_id: string;
  file_name: string;
  bindings: BindingSpec[] | undefined;
}
export interface PythonPoetryArgs {
  with: DependencyGroup | undefined;
  without: DependencyGroup | undefined;
  dev: boolean | undefined;
  all_extras: boolean | undefined;
  without_hashes: boolean | undefined;
  without_urls: boolean | undefined;
}
export interface BindingSpec {
  resource_type: ResourceType;
  resource_id: string;
  scopes: string[];
  props: Record<string, string> | undefined;
}
export type ResourceType = "bucket" | "queue" | "function";
export type DependencyGroup = [string, ...string[]] | string | undefined;
export interface QueueSpec {
  queue_id: string;
  fifo: boolean;
  subscriptions: QueueSubscriptionSpec[];
}
export interface QueueSubscriptionSpec {
  function_id: string;
}
export interface BucketSpec {
  bucket_id: string;
  subscriptions: BucketSubscriptionSpec[];
}
export interface BucketSubscriptionSpec {
  scope: BucketSubscriptionScope;
  function_id: string;
}
export type BucketSubscriptionScope = "create" | "update" | "delete";