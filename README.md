# Packyak ![image](https://github.com/sam-goodwin/packyak/assets/38672686/249af136-45fb-4d13-82bb-5818e803eeb0)

Packyak is a python library and platform for building data pipelines that clean datasets and train ML models with human supervision and feedback.

It automatically provisions all required infrastructure and guarantees a least-privilege and privacy compliant data architecture.

# Features

1. Train transformation functions (using AI) that are supervised by humans and continually improved with feedback and corrections.
2. Orchestrate transformation with dependency graphs (DAGs)
3. Compute data sets when new data arrives or when its dependencies change
4. Re-compute data sets when a transformation function is changed or improves from learning
5. Auto-provision all required cloud infrastructure
6. Auto-configured to be compliant with privacy regulations such as HIPAA and GDPR
7. Least-privilege IAM policies with auto-generated reports for regulators

# Example

> 🔧 Note: Packyak is in active development. Not all features are implemented. Check back to see the following example grow.

Below is the most simple Packyak application: a Bucket with a Function that writes to it.

Your application's infrastructure is declared in code. The Packyak compiler analyzes it to auto-provision cloud resources (in this case AWS S3 Bucket and Lambda Function) with least privilege IAM Policy inference.

```py
from packyak import Bucket, function

videos = Bucket("videos")

@function()
async def upload_video():
    await videos.put("key", "value")

@asset()
async def transcribed_videos():
  ...
```

# Research

Inspired by (and integrating with):

- [ ] https://dagster.io/
- [ ] https://www.llamaindex.ai/
- [ ] https://unstructured.io/
- [ ] https://docs.modular.com/mojo/roadmap.html
- [ ] https://www.nextflow.io/
- [ ] https://github.com/OpenLineage/openlineage
- [ ] https://aws.amazon.com/what-is/vector-databases/
- [ ] https://aws.amazon.com/neptune/machine-learning/
- [ ] https://www.dgl.ai/
- [ ] https://aws.amazon.com/blogs/machine-learning/build-streamlit-apps-in-amazon-sagemaker-studio/
