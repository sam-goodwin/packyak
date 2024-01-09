type RefinerySpec = {
  buckets: BucketSpec[];
  queues: QueueSpec[];
  functions: FunctionSpec[];
}
type FunctionSpec = {
  function_id: string;
  file_name: string;
  bindings: BindingSpec[];
}
type BindingSpec = {
  resource_type: ResourceType;
  resource_id: string;
  scopes: string[];
  props: string | string;
}
type ResourceType = "bucket" | "queue" | "function";
type QueueSpec = {
  queue_id: string;
  fifo: number;
  subscriptions: QueueSubscriptionSpec[];
}
type QueueSubscriptionSpec = {
  function_id: string;
}
type BucketSpec = {
  bucket_id: string;
  subscriptions: BucketSubscriptionSpec[];
}
type BucketSubscriptionSpec = {
  scope: BucketSubscriptionScope;
  function_id: string;
}
type BucketSubscriptionScope = "create" | "update" | "delete";