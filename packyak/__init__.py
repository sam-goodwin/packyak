import os
from typing import Never
from .function import function
from .bucket import Bucket
from .queue import Queue, Message, ReceivedMessagesEvent
from .synth import synth, is_synth


def init() -> None | Never:
    """
    Synthesizes the packyak spec to disk if the PACKYAK_SYNTH environment variable is set.

    If PACKYAK_SYNTH is falsy, then this function does nothing.

    Otherwise, it analyzes the application, writes the spec to .packyak/spec.json, and exits.

    Why it exits:
    This function is designed to be called at the end of a program or before a script.
    └→ e.g. for streamlit scripts, we don't want to run the streamlit application during build, only during runtime.
    """
    if is_synth():
        packyak_spec = synth()
        if not os.path.exists(".packyak"):
            os.makedirs(".packyak")
        with open(".packyak/spec.json", "w") as f:
            f.write(
                packyak_spec.model_dump_json(
                    indent=2, exclude_unset=True, exclude_none=True
                )
            )
        exit(0)
    else:
        # TODO: initialize runtime environment variables
        pass


__all__ = ["function", "Bucket", "Queue", "Message", "ReceivedMessagesEvent", "init"]
