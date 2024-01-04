# Research

- [ ] https://dagster.io/
- [ ] https://www.llamaindex.ai/
- [ ] https://unstructured.io/
- [ ] https://docs.modular.com/mojo/roadmap.html

# Refinery

Refinery is a python library and platform for refining data sets from semi or un-structured data.

It provides primitives for:

1. Training AI data transformation functions that are supervised by humans and continually improved with feedback and corrections.
2. Orchestrating transformation
3. Computing data sets when new data arrives or re-computing when its dependencies change
4. Re-computing data sets when a transformation function is changed or improves from learning

```py
def asset():
  pass

@function(requires_approval=True)
def transcribe(video_id: Video[Mpeg4]) -> List[str]:
  pass

@function()
def diarize(transcript: str) -> List[Tuple[str, str]]:
  pass

@function()
def segment(transcript: str) -> List[str]:
  context: Optional[str] = None
  for chunk in split(transcript):
    response = yield openai.chat.completion.create(
      messages=[
        user(message=f"Context:{context}\nChunk:{chunk}"),
      ]
    )
    context = f"{context}\{chunk}\n{response}"


def hearing_transcripts():
  pass
```
