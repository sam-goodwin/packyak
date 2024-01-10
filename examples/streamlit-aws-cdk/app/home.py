import warnings

warnings.filterwarnings(
    "ignore", category=SyntaxWarning
)  # streamlit has bugs when run in python 3.12

import streamlit as st
import pandas as pd
import yakka

from .resources import videos

yakka.init()


@st.cache_data()
def get_large_video():
    # interact with the bucket
    videos.get_sync("key")
    return df


df = pd.DataFrame(
    {
        "first column": pd.Series([1, 2, 3, 4], dtype=int),
        "second column": pd.Series([10, 20, 30, 40], dtype=int),
    }
)


col1 = df["first column"]
option = st.selectbox("Which number do you like best?", col1)

"You selected: ", option
