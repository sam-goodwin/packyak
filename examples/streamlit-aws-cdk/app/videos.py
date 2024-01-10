from packyak import Bucket


videos = Bucket("videos")


@videos.on("create")
def process_video(event: Bucket.ObjectCreatedEvent):
    print("Processing video", event.key)
