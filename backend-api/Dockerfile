FROM php:8.3-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip libicu-dev \
    && docker-php-ext-install intl pdo pdo_mysql \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . .

RUN composer install --no-interaction --prefer-dist || true \
    && chown -R www-data:www-data /var/www/html

RUN chmod +x /var/www/html/docker-entrypoint.sh

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public

RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
    && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}/!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

EXPOSE 80

ENTRYPOINT ["/var/www/html/docker-entrypoint.sh"]
CMD ["apache2-foreground"]
