FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Security fix not yet in the python:3.11-slim base image (zlib1g HIGH CVEs with a Debian fix).
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade zlib1g \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# The base image's setuptools 79 vendors vulnerable wheel 0.45.1 / jaraco.context 5.3.0 (HIGH in Trivy).
RUN pip install --no-cache-dir --upgrade setuptools==84.2.1 \
    && pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Run as an unprivileged system user (the service writes nothing to disk).
RUN useradd --system --uid 10001 --no-create-home app
USER app
EXPOSE 3010

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3010"]
