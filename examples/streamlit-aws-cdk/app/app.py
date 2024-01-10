import streamlit as st
import pandas as pd
import yakka

# not sure why, but streamlit is throwing a deprecation warning
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning)

yakka.synth()

df = pd.DataFrame(
    {
        "first column": pd.Series([1, 2, 3, 4], dtype=int),
        "second column": pd.Series([10, 20, 30, 40], dtype=int),
    }
)

col1 = df["first column"]
option = st.selectbox("Which number do you like best?", col1)

"You selected: ", option
