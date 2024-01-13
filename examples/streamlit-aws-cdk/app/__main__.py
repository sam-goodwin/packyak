import warnings

warnings.filterwarnings(
    "ignore", category=SyntaxWarning
)  # streamlit has bugs when run in python 3.12

import packyak

#####
# Import all resources that exist in the application
#
# TODO: can this be streaminlined/automated?
# Solution?: auto-import home.py and pages/*.py?
####

# ruff: noqa: F403 - ruff warns about this patter, we need to find something better

from .videos import *

packyak.init()
