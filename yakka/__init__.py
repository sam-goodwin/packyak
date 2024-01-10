import os
from typing import Never
from .function import function
from .bucket import Bucket
from .queue import Queue, Message, ReceivedMessagesEvent
from .synth import synth, is_synth


def init() -> None | Never:
    """
    Synthesizes the yakka spec to disk if the YAKKA_SYNTH environment variable is set.

    If YAKKA_SYNTH is falsy, then this function does nothing.

    Otherwise, it analyzes the application, writes the spec to .yakka/spec.json, and exits.

    Why it exits:
    This function is designed to be called at the end of a program or before a script.
    └→ e.g. for streamlit scripts, we don't want to run the streamlit application during build, only during runtime.
    """
    if is_synth():
        yakka_spec = synth()
        if not os.path.exists(".yakka"):
            os.makedirs(".yakka")
        with open(".yakka/spec.json", "w") as f:
            f.write(
                yakka_spec.model_dump_json(
                    indent=2, exclude_unset=True, exclude_none=True
                )
            )
        exit(0)
    else:
        # TODO: initialize runtime environment variables
        pass


__all__ = ["function", "Bucket", "Queue", "Message", "ReceivedMessagesEvent", "init"]
