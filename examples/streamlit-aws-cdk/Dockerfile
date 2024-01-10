FROM python:3.12-slim

WORKDIR /
COPY requirements.txt requirements.txt
COPY . .

RUN pip install -r requirements.txt

EXPOSE 8501
CMD ["streamlit", "run", "1_🏠_Home.py"]