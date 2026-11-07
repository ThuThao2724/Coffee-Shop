FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Run as an unprivileged system user (the service writes nothing to disk).
RUN useradd --system --uid 10001 --no-create-home app
USER app
EXPOSE 3010

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3010"]
