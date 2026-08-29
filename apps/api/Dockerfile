FROM python:3.12-slim

WORKDIR /app
RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY northstar ./northstar
RUN uv sync --frozen --no-dev

ENV PORT=8080
CMD ["sh", "-c", "uv run uvicorn northstar.api.app:app --host 0.0.0.0 --port ${PORT}"]
