import pandas as pd
from packyak import Bucket, function
from app.videos import get_video

bucket = Bucket("bucket")


@function()
def some_func():
    return bucket.get_sync("my-key")


if __name__ == "__main__":
    import streamlit as st

    df = pd.DataFrame(
        {
            "first column": pd.Series([1, 2, 3, 4], dtype=int),
            "second column": pd.Series([10, 20, 30, 40], dtype=int),
        }
    )

    def get_stuff(key: str):
        return bucket.get_sync(key)

    col1 = df["first column"]

    df

    option = st.selectbox("Which number do you like best?", col1)

    "You selected: ", option

    key = st.text_input("Enter a key to get from the bucket", "my-key")

    obj = get_stuff(key)
    video = get_video(key)

    if obj:
        st.write(obj.body.read().decode("utf-8"))
    else:
        st.write("No object found")
