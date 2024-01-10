import warnings

warnings.filterwarnings(
    "ignore", category=SyntaxWarning
)  # streamlit has bugs when run in python 3.12

import yakka

from .resources import *

yakka.init()
