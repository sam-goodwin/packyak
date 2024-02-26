import streamlit as st
from my_app.videos import get_video

if __name__ == "__main__":
    st.write("Hello world!")
    video = get_video("foo")
