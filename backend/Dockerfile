FROM python:3.12-slim

WORKDIR /app

# Install system dependencies with retry
RUN apt-get update --fix-missing && \
    apt-get install -y --no-install-recommends libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 5000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]