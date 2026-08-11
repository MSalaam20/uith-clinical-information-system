FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN DJANGO_DEBUG=False \
    DJANGO_SECRET_KEY=synthetic-build-only-secret-key-not-for-runtime \
    python manage.py collectstatic --noinput

CMD ["sh", "-c", "gunicorn backend.wsgi:application --bind [::]:${PORT:-8000}"]
