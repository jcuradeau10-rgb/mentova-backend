FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ || echo "emergentintegrations not available, using fallback"

COPY backend/ .

RUN mkdir -p uploads

EXPOSE 8001

CMD ["uvicorn", "server:socket_app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
