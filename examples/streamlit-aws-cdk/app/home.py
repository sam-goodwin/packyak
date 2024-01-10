import streamlit as st
import pandas as pd

from .videos import videos


@st.cache_data()
def get_large_video():
    return videos.get_sync("key")


df = pd.DataFrame(
    {
        "first column": pd.Series([1, 2, 3, 4], dtype=int),
        "second column": pd.Series([10, 20, 30, 40], dtype=int),
    }
)


col1 = df["first column"]
option = st.selectbox("Which number do you like best?", col1)

"You selected: ", option
