export type PackyakSpec = {
  buckets: BucketSpec[];
  queues: QueueSpec[];
  functions: FunctionSpec[];
};
export type FunctionSpec = {
  function_id: string;
  file_name: string;
  bindings: BindingSpec[];
};
export type BindingSpec = {
  resource_type: ResourceType;
  resource_id: string;
  scopes: string[];
  props: string | string;
};
type ResourceType = "bucket" | "queue" | "function";
export type QueueSpec = {
  queue_id: string;
  fifo: number;
  subscriptions: QueueSubscriptionSpec[];
};
export type QueueSubscriptionSpec = {
  function_id: string;
};
export type BucketSpec = {
  bucket_id: string;
  subscriptions: BucketSubscriptionSpec[];
};
export type BucketSubscriptionSpec = {
  scope: BucketSubscriptionScope;
  function_id: string;
};
type BucketSubscriptionScope = "create" | "update" | "delete";
