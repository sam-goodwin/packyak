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
import app.videos

packyak.init()
