# syntax=docker/dockerfile:1
# ===========================================================================
# McGate Workforce Production Multi-Stage Container Image
# Front-end: React 19 + TypeScript + Vite
# Back-end:  Python 3.12 + Django 5 + Gunicorn + WhiteNoise
# ===========================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build React/Vite Frontend
# ---------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Python Dependency Builder
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libjpeg62-turbo-dev \
    zlib1g-dev \
    libpng-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

# ---------------------------------------------------------------------------
# Stage 3: Runtime Container
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH="/app/backend:/app/backend/apps:$PYTHONPATH" \
    DJANGO_SETTINGS_MODULE=mcgate_backend.settings \
    MEDIA_ROOT=/app/media \
    STATIC_ROOT=/app/backend/staticfiles \
    PORT=8000 \
    GUNICORN_WORKERS=3 \
    GUNICORN_THREADS=2 \
    GUNICORN_TIMEOUT=120

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libjpeg62-turbo \
    zlib1g \
    libpng16-16 \
    curl \
    gosu \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1000 mcgate \
    && useradd --system --uid 1000 --gid mcgate --home /app --shell /usr/sbin/nologin mcgate \
    && mkdir -p /app/media /app/backend/staticfiles /app/backend/data \
    && chown -R mcgate:mcgate /app

# Install compiled python packages
COPY --from=builder /app/wheels /wheels
COPY requirements.txt .
RUN pip install --no-cache /wheels/* && rm -rf /wheels

# Copy backend application source and entry scripts
COPY backend/ /app/backend/
COPY scripts/ /app/scripts/

# Copy compiled frontend from Stage 1 into both dist locations
COPY --from=frontend-builder /app/dist /app/dist
COPY --from=frontend-builder /app/dist /app/backend/templates/dist

RUN chmod +x /app/scripts/docker-start.sh /app/scripts/healthcheck.sh \
    && chown -R mcgate:mcgate /app

# Pre-collect static files during build
RUN python backend/manage.py collectstatic --noinput

USER root

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["/app/scripts/healthcheck.sh"]

ENTRYPOINT ["/app/scripts/docker-start.sh"]
CMD ["gunicorn", "mcgate_backend.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--threads", "2", "--timeout", "120"]
