FROM ubuntu:24.04

# Avoid prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install LibreOffice (calc, writer, impress), Python 3, and python3-uno bridge
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-calc \
    libreoffice-writer \
    libreoffice-impress \
    python3 \
    python3-pip \
    python3-uno \
    && rm -rf /var/lib/apt/lists/*

# Working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy application source
COPY src/ /app/src/

# Run the worker
CMD ["python3", "-m", "src.worker"]
