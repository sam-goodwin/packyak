# Refinery

Refinery is a python library and platform for refining data sets from semi or un-structured data. It automatically provisions all required infrastructure and guarantees a least-privilege and privacy compliant data architecture.

# Features

1. Training transformation functions (using AI) that are supervised by humans and continually improved with feedback and corrections.
2. Orchestrating transformation with dependency graphs (DAGs)
3. Computing data sets when new data arrives or re-computing when its dependencies change
4. Re-computing data sets when a transformation function is changed or improves from learning
5. Auto-provision all required cloud infrastructure
6. Auto-configured to be compliant with privacy regulations such as HIPAA and GDPR
7. Least-privilege IAM policies with auto-generated reports for regulators

# Example

> 🔧 Note: Refinery is in active development. Not all features are implemented. Check back to see the following example grow.

Below is the most simple Refinery application: a Bucket with a Function that writes to it.

Your application's infrastructure is declared in code. The Refinery compiler analyzes it to auto-provision cloud resources (in this case AWS S3 Bucket and Lambda Function) with least privilege IAM Policy inference.

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
