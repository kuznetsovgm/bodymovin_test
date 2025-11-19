# Monitoring Setup

Этот проект включает полный стек мониторинга и логирования с использованием Prometheus, Loki и Grafana.

## Компоненты

### 1. Prometheus

**URL:** http://localhost:9099

Prometheus собирает метрики из следующих источников:

- **Bot Metrics** (порт 9099): Метрики приложения бота
- **Redis Exporter** (порт 9121): Метрики Redis

### 2. Loki

**URL:** http://localhost:3100

Loki собирает и хранит логи из:

- Приложения бота (через winston-loki transport)
- Docker контейнеров (через Promtail)

### 3. Grafana

**URL:** http://localhost:3000
**Логин по умолчанию:** admin / admin

Grafana предоставляет визуализацию метрик и логов через:

- Преднастроенные дашборды
- Автоматически подключенные источники данных (Prometheus и Loki)

## Доступные Метрики

### Метрики Inline Queries

- `bot_inline_queries_total` - Общее количество inline-запросов
  - Labels: `status` (success, error, empty, debounced)

### Метрики Генерации Стикеров

- `bot_stickers_generated_total` - Общее количество сгенерированных стикеров
  - Labels: `animation_type`, `status` (success/error)
- `bot_sticker_generation_duration_seconds` - Время генерации стикера
  - Labels: `animation_type`
  - Buckets: [0.1, 0.5, 1, 2, 5, 10] секунд

### Метрики Загрузки

- `bot_upload_duration_seconds` - Время загрузки стикера в Telegram
  - Buckets: [0.5, 1, 2, 5, 10, 30] секунд

### Метрики Ошибок

- `bot_errors_total` - Общее количество ошибок
  - Labels: `error_type` (generation_error, upload_error, cache_error, etc.)

### Метрики Кэша

- `bot_cache_hits_total` - Количество попаданий в кэш
  - Labels: `cache_type` (sticker, config, etc.)
- `bot_cache_misses_total` - Количество промахов кэша
  - Labels: `cache_type`
- `bot_cache_size_bytes` - Размер кэша в байтах
  - Labels: `cache_type`

### Метрики Redis

- `bot_redis_operations_total` - Общее количество операций Redis
  - Labels: `operation` (get/set/del), `status` (success/error)
- `bot_redis_connection_status` - Статус подключения к Redis (1 = подключен, 0 = отключен)

### Метрики Telegram API

- `bot_telegram_api_calls_total` - Общее количество вызовов Telegram API
  - Labels: `method` (sendSticker, answerInlineQuery, etc.), `status`
- `bot_telegram_api_duration_seconds` - Длительность вызовов Telegram API
  - Labels: `method`

### Системные Метрики

- `bot_health_status` - Статус здоровья бота (1 = здоров, 0 = нездоров)
- `bot_active_users` - Количество активных пользователей
- `process_resident_memory_bytes` - Использование памяти
- `process_cpu_seconds_total` - Использование CPU
- `process_uptime_seconds` - Время работы процесса

## Структурированное Логирование

Логи отправляются в Loki с следующими полями:

### События Inline Query

```json
{
  "event": "inline_query",
  "query": "текст запроса",
  "userId": 12345,
  "success": true,
  "duration": 1.234
}
```

### События Генерации Стикеров

```json
{
  "event": "sticker_generation",
  "animationType": "slide",
  "text": "HELLO",
  "success": true,
  "duration": 2.345,
  "error": "описание ошибки (если есть)"
}
```

### События Загрузки

```json
{
  "event": "sticker_upload",
  "fileId": "CAACAgIAAxk...",
  "chatId": "-100123456789",
  "success": true,
  "duration": 0.789
}
```

### Операции с Кэшем

```json
{
  "event": "cache_operation",
  "operation": "get",
  "key": "hash_key",
  "hit": true,
  "cacheType": "sticker"
}
```

## Дашборды Grafana

### Bodymovin Bot Overview

Основной дашборд включает:

1. **Inline Queries Rate** - График скорости обработки inline-запросов
2. **Bot Health Status** - Индикатор здоровья бота
3. **Stickers Generated Rate** - Скорость генерации стикеров по типам анимации
4. **Sticker Generation Duration** - Перцентили времени генерации (p50, p95)
5. **Cache Hit Rate** - Процент попаданий в кэш
6. **Errors Rate** - Скорость возникновения ошибок по типам
7. **Redis Connection** - Статус подключения к Redis
8. **Memory Usage** - Использование памяти
9. **Uptime** - Время работы бота
10. **CPU Usage** - Использование процессора

## Запуск

### Запуск всего стека мониторинга:

```bash
docker-compose up -d
```

### Проверка статуса:

```bash
docker-compose ps
```

### Просмотр логов:

```bash
# Все сервисы
docker-compose logs -f

# Только бот
docker-compose logs -f bot

# Только Grafana
docker-compose logs -f grafana
```

### Остановка:

```bash
docker-compose down
```

### Остановка с удалением данных:

```bash
docker-compose down -v
```

## Переменные Окружения

Добавьте в `.env` файл:

```bash
# Bot Configuration
BOT_TOKEN=your_bot_token_here
NODE_ENV=production

# Logging
LOG_LEVEL=info
ENABLE_LOKI=true
LOKI_HOST=http://loki:3100

# Metrics
METRICS_PORT=9099

# Grafana (опционально, по умолчанию admin/admin)
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=your_secure_password
```

## Endpoints

### Bot

- **Metrics:** http://localhost:9095/metrics
- **Health:** http://localhost:9095/health

### Prometheus

- **Web UI:** http://localhost:9099
- **API:** http://localhost:9099/api/v1/

### Loki

- **API:** http://localhost:3100

### Grafana

- **Web UI:** http://localhost:3000

## Примеры Запросов Prometheus

### Скорость inline-запросов за последние 5 минут:

```promql
rate(bot_inline_queries_total[5m])
```

### 95-й перцентиль времени генерации стикеров:

```promql
histogram_quantile(0.95, rate(bot_sticker_generation_duration_seconds_bucket[5m]))
```

### Коэффициент попадания в кэш:

```promql
rate(bot_cache_hits_total[5m]) / (rate(bot_cache_hits_total[5m]) + rate(bot_cache_misses_total[5m]))
```

### Скорость ошибок по типам:

```promql
rate(bot_errors_total[5m])
```

## Примеры Запросов LogQL (Loki)

### Все логи бота:

```logql
{app="bodymovin-bot"}
```

### Только ошибки:

```logql
{app="bodymovin-bot"} |= "error"
```

### События генерации стикеров:

```logql
{app="bodymovin-bot"} | json | event="sticker_generation"
```

### Медленная генерация (> 5 секунд):

```logql
{app="bodymovin-bot"} | json | event="sticker_generation" | duration > 5
```

## Алерты (Опционально)

Можно добавить алерты в Prometheus для:

- Высокой частоты ошибок
- Длительного времени генерации стикеров
- Падения коэффициента попадания в кэш
- Проблем с подключением к Redis
- Высокого использования памяти

Пример правила алерта (`prometheus-alerts.yml`):

```yaml
groups:
  - name: bot_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(bot_errors_total[5m]) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Высокая частота ошибок в боте'
          description: 'Более 1 ошибки в секунду за последние 5 минут'

      - alert: SlowStickerGeneration
        expr: histogram_quantile(0.95, rate(bot_sticker_generation_duration_seconds_bucket[5m])) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Медленная генерация стикеров'
          description: '95-й перцентиль времени генерации > 10 секунд'

      - alert: RedisDown
        expr: bot_redis_connection_status == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Отсутствует подключение к Redis'
          description: 'Бот не может подключиться к Redis'
```

## Troubleshooting

### Метрики не отображаются в Grafana

1. Проверьте, что бот запущен: `docker-compose ps bot`
2. Проверьте endpoint метрик: `curl http://localhost:9099/metrics`
3. Проверьте targets в Prometheus: http://localhost:9099/targets

### Логи не появляются в Loki

1. Проверьте переменную `ENABLE_LOKI=true` в `.env`
2. Проверьте логи Loki: `docker-compose logs loki`
3. Проверьте подключение: `curl http://localhost:3100/ready`

### Grafana не показывает данные

1. Проверьте datasources в Grafana: Settings → Data Sources
2. Проверьте, что Prometheus и Loki доступны
3. Попробуйте запрос в Explore

## Ресурсы

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Grafana Documentation](https://grafana.com/docs/grafana/latest/)
- [prom-client (Node.js)](https://github.com/siimon/prom-client)
- [Winston Logger](https://github.com/winstonjs/winston)
