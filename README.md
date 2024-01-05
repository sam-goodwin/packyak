# Refinery

Refinery is a python library and platform for refining data sets from semi or un-structured data. It automatically provisions all required infrastructure and guarantees a least-privilege and privacy compliant data architecture.

> 🔧 Note: Refinery is in active development.

It will provide primitives for:

1. Training AI data transformation functions that are supervised by humans and continually improved with feedback and corrections.
2. Orchestrating transformation with dependency graphs (DAGs)
3. Computing data sets when new data arrives or re-computing when its dependencies change
4. Re-computing data sets when a transformation function is changed or improves from learning

```py
from refinery import Bucket, function

videos = Bucket("videos")

@function()
async def upload_video():
    await videos.put("key", "value")
```

# Research

Inspired by (and integrating with):

- [ ] https://dagster.io/
- [ ] https://www.llamaindex.ai/
- [ ] https://unstructured.io/
- [ ] https://docs.modular.com/mojo/roadmap.html
