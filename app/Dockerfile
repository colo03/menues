FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/var/data \
    PORT=8080 \
    TZ=America/Argentina/Buenos_Aires

WORKDIR /app
COPY . /app
RUN mkdir -p /var/data /var/data/uploads

EXPOSE 8080
CMD ["python", "-B", "server.py"]
