# Monitoring Implementation Summary

## Что было добавлено

### 1. Метрики (Prometheus)

**Файл:** `src/metrics.ts`

Реализованы следующие метрики:

- **Inline Queries:** количество и статус запросов
- **Sticker Generation:** время генерации, количество по типам анимации
- **Cache:** hit/miss rate, размер кэша
- **Redis:** статус подключения, операции
- **Telegram API:** количество вызовов, длительность
- **System:** память, CPU, uptime, health status

### 2. Структурированное логирование (Loki)

**Файл:** `src/logger.ts`

Реализован Winston logger с:

- Отправкой логов в Loki (в production)
- Консольным выводом с цветами
- Структурированными событиями (JSON)
- Helper функциями для различных типов событий

### 3. Интеграция в бот

**Файл:** `src/bot.ts`

Добавлено:

- HTTP сервер для метрик (/metrics) и health check (/health)
- Сбор метрик при каждой операции
- Логирование всех важных событий
- Мониторинг Redis подключения
- Graceful shutdown с обновлением метрик

### 4. Docker Compose

**Файл:** `docker-compose.yml`

Добавлены сервисы:

- **prometheus:** Сбор и хранение метрик
- **loki:** Агрегация логов
- **promtail:** Сбор логов из Docker контейнеров
- **grafana:** Визуализация метрик и логов
- **redis-exporter:** Метрики Redis

### 5. Grafana Provisioning

**Директория:** `grafana/provisioning/`

Создано:

- Автоматическая конфигурация data sources (Prometheus, Loki)
- Преднастроенный дашборд "Bodymovin Bot Overview"
- Автоматический импорт дашбордов при запуске

### 6. Конфигурационные файлы

- `prometheus.yml` - конфигурация Prometheus
- `loki-config.yml` - конфигурация Loki
- `promtail-config.yml` - конфигурация Promtail
- `prometheus-alerts.yml` - правила алертов (опционально)

### 7. Документация

- `MONITORING.md` - полная документация мониторинга
- `QUICKSTART.md` - быстрый старт
- Обновлен `README.md` с информацией о мониторинге
- Обновлен `.env.example` с новыми переменными

### 8. Dockerfile

**Файл:** `Dockerfile`

Изменения:

- Добавлен wget для health checks
- Добавлен HEALTHCHECK
- Экспонирован порт 9099 для метрик

## Переменные окружения

Новые переменные в `.env`:

```bash
# Logging
LOG_LEVEL=info
ENABLE_LOKI=true
LOKI_HOST=http://loki:3100

# Metrics
METRICS_PORT=3099

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
```

## Endpoints

После запуска доступны:

- **Bot Metrics:** http://localhost:9095/metrics
- **Bot Health:** http://localhost:9095/health
- **Grafana:** http://localhost:3000
- **Prometheus:** http://localhost:9099
- **Loki:** http://localhost:3100

## Как использовать

### Запуск

```bash
docker-compose up -d
```

### Просмотр метрик

1. Откройте Grafana: http://localhost:3000
2. Логин: admin/admin
3. Выберите дашборд "Bodymovin Bot Overview"

### Просмотр логов

В Grafana:

1. Перейдите в Explore
2. Выберите Loki data source
3. Используйте запрос: `{app="bodymovin-bot"}`

### Проверка здоровья

```bash
curl http://localhost:9099/health
```

## Grafana Dashboard

Дашборд "Bodymovin Bot Overview" включает панели:

1. **Inline Queries Rate** - График запросов в секунду
2. **Bot Health Status** - Статус здоровья (gauge)
3. **Stickers Generated Rate** - Генерация по типам
4. **Sticker Generation Duration** - Перцентили времени (p50, p95)
5. **Cache Hit Rate** - Эффективность кэша
6. **Errors Rate** - Ошибки по типам
7. **Redis Connection** - Статус Redis
8. **Memory Usage** - Использование памяти
9. **Uptime** - Время работы
10. **CPU Usage** - Нагрузка на процессор

## Метрики для мониторинга производительности

### Критические метрики:

- `bot_health_status` - должен быть 1
- `bot_redis_connection_status` - должен быть 1
- `bot_errors_total` - должен расти медленно

### Метрики производительности:

- `bot_sticker_generation_duration_seconds` - p95 < 10s желательно
- `bot_cache_hits_total / (bot_cache_hits_total + bot_cache_misses_total)` - > 70% желательно
- `process_resident_memory_bytes` - < 1GB нормально

### Метрики использования:

- `bot_inline_queries_total` - активность пользователей
- `bot_stickers_generated_total` - объем генерации
- `bot_active_users` - количество активных пользователей

## Алерты (опционально)

Файл `prometheus-alerts.yml` содержит правила для:

- Высокой частоты ошибок
- Медленной генерации стикеров
- Отключения Redis
- Проблем с памятью/CPU
- Высокой частоты отказов загрузки

Для включения алертов:

1. Раскомментируйте секцию в `prometheus.yml`
2. Настройте Alertmanager (не включен в этот setup)

## Зависимости

Новые npm пакеты:

- `prom-client` - Prometheus клиент для Node.js
- `winston` - Логирование
- `winston-loki` - Транспорт Winston для Loki

## Производительность

Overhead от мониторинга:

- **Метрики:** ~1-2% CPU, ~10MB RAM
- **Логирование:** минимальное при уровне "info"
- **HTTP сервер:** <1% CPU, ~5MB RAM

Общий overhead: ~15-20MB RAM, 2-3% CPU

## Best Practices

1. **Production:** Используйте `LOG_LEVEL=info` или `warn`
2. **Development:** Используйте `LOG_LEVEL=debug`
3. **Retention:** Prometheus хранит данные 30 дней по умолчанию
4. **Grafana:** Регулярно экспортируйте дашборды для backup
5. **Alerts:** Настройте алерты для критических метрик

## Troubleshooting

См. секцию Troubleshooting в `QUICKSTART.md` и `MONITORING.md`

## Дальнейшие улучшения

Возможные улучшения:

1. Настроить Alertmanager для уведомлений
2. Добавить трейсинг (Jaeger/Tempo)
3. Добавить метрики бизнес-логики
4. Создать дополнительные дашборды
5. Настроить retention policies для Loki
6. Добавить метрики по пользователям
