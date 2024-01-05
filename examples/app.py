from refinery.bucket import Bucket
from refinery.function import function

videos = Bucket(id="videos")


@function()
async def upload_video(key: str, file: str):
    await videos.put(key, file)


if __name__ == "__main__":
    # from refinery.synth.local import synth

    # bindings = synth()

    # print(bindings)

    from refinery.synth.aws_cdk import RefineryStack
    from aws_cdk import App

    app = App()
    stack = RefineryStack(app, "example-refinery-service")
    app.synth()
