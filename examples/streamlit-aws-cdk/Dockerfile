FROM python:3.12-alpine3.19

RUN apk update && apk upgrade

RUN apk add --no-cache \
  build-base \
  gcc \
  cmake \
  python3-dev \
  apache-arrow \
  apache-arrow-dev

RUN pip install pyarrow pandas

ARG REQUIREMENTS_PATH

COPY ${REQUIREMENTS_PATH} requirements.txt

RUN pip install -r requirements.txt

COPY app /app

ENV PYTHONPATH=/

EXPOSE 8501

CMD ["streamlit", "run", "app/home.py", "--server.port=8501", "--server.address=0.0.0.0", "--server.fileWatcherType=none"]
