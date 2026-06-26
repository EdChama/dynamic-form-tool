#!/bin/sh
set -e

if [ "${AUTO_MIGRATE:-true}" = "true" ]; then
    echo "Running database migrations..."
    php /var/www/html/spark migrate
fi

if [ "${AUTO_SEED:-false}" = "true" ]; then
    echo "Running database seed data..."
    php /var/www/html/spark db:seed
fi

exec docker-php-entrypoint "$@"
