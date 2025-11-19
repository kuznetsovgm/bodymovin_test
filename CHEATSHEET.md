# Мониторинг - Шпаргалка

## 🚀 Базовые команды

### Запуск и остановка

```bash
# Запустить все сервисы
docker-compose up -d

# Остановить все сервисы
docker-compose down

# Перезапустить бот
docker-compose restart bot

# Пересобрать и запустить
docker-compose up -d --build
```

### Просмотр логов

```bash
# Все сервисы
docker-compose logs -f

# Только бот
docker-compose logs -f bot

# Последние 100 строк
docker-compose logs --tail=100 bot

# Только ошибки
docker-compose logs bot | grep -i error
```

### Проверка статуса

```bash
# Статус контейнеров
docker-compose ps

# Использование ресурсов
docker stats

# Проверка здоровья
./scripts/health-check.sh

# Тестирование мониторинга
./scripts/test-monitoring.sh
```

## 🔗 Endpoints

```bash
# Bot
curl http://localhost:9095/health
curl http://localhost:9095/metrics

# Prometheus
curl http://localhost:9099/-/healthy
curl http://localhost:9099/api/v1/targets

# Loki
curl http://localhost:3100/ready

# Grafana
curl http://localhost:3000/api/health
```

## 📊 Prometheus Queries

### Inline Queries

```promql
# Rate per second
rate(bot_inline_queries_total[5m])

# Total count
sum(bot_inline_queries_total)

# By status
rate(bot_inline_queries_total[5m]) by (status)
```

### Sticker Generation

```promql
# Rate by animation type
rate(bot_stickers_generated_total[5m]) by (animation_type)

# P50 latency
histogram_quantile(0.50, rate(bot_sticker_generation_duration_seconds_bucket[5m]))

# P95 latency
histogram_quantile(0.95, rate(bot_sticker_generation_duration_seconds_bucket[5m]))

# P99 latency
histogram_quantile(0.99, rate(bot_sticker_generation_duration_seconds_bucket[5m]))
```

### Cache

```promql
# Hit rate
rate(bot_cache_hits_total[5m]) / (rate(bot_cache_hits_total[5m]) + rate(bot_cache_misses_total[5m]))

# Total hits
sum(rate(bot_cache_hits_total[5m]))

# Total misses
sum(rate(bot_cache_misses_total[5m]))
```

### Errors

```promql
# Error rate
rate(bot_errors_total[5m])

# Errors by type
rate(bot_errors_total[5m]) by (error_type)

# Error percentage
rate(bot_errors_total[5m]) / rate(bot_inline_queries_total[5m]) * 100
```

### System

```promql
# Memory usage (bytes)
process_resident_memory_bytes{job="bodymovin-bot"}

# Memory usage (MB)
process_resident_memory_bytes{job="bodymovin-bot"} / 1024 / 1024

# CPU usage (%)
rate(process_cpu_seconds_total{job="bodymovin-bot"}[1m]) * 100

# Uptime (seconds)
process_uptime_seconds{job="bodymovin-bot"}

# Uptime (hours)
process_uptime_seconds{job="bodymovin-bot"} / 3600
```

### Health

```promql
# Bot health
bot_health_status

# Redis connection
bot_redis_connection_status

# All up targets
up{job="bodymovin-bot"}
```

## 🔍 Loki Queries (LogQL)

### Basic

```logql
# All logs
{app="bodymovin-bot"}

# Last hour
{app="bodymovin-bot"} [1h]

# Specific level
{app="bodymovin-bot"} | json | level="error"

# Contains text
{app="bodymovin-bot"} |= "generation"
```

### Events

```logql
# Inline query events
{app="bodymovin-bot"} | json | event="inline_query"

# Sticker generation events
{app="bodymovin-bot"} | json | event="sticker_generation"

# Upload events
{app="bodymovin-bot"} | json | event="sticker_upload"

# Cache operations
{app="bodymovin-bot"} | json | event="cache_operation"

# Errors only
{app="bodymovin-bot"} | json | event="error"
```

### Filtering

```logql
# Successful generations
{app="bodymovin-bot"} | json | event="sticker_generation" | success="true"

# Failed uploads
{app="bodymovin-bot"} | json | event="sticker_upload" | success="false"

# Slow generations (>5s)
{app="bodymovin-bot"} | json | event="sticker_generation" | duration > 5

# Specific animation type
{app="bodymovin-bot"} | json | animationType="slide"
```

### Aggregations

```logql
# Count by event
sum(count_over_time({app="bodymovin-bot"} | json [5m])) by (event)

# Rate of errors
rate({app="bodymovin-bot"} | json | level="error" [5m])

# Average duration
avg_over_time({app="bodymovin-bot"} | json | event="sticker_generation" | unwrap duration [5m])
```

## 🐳 Docker Commands

### Container Management

```bash
# Restart specific service
docker-compose restart bot

# Stop specific service
docker-compose stop bot

# Start specific service
docker-compose start bot

# Remove and recreate
docker-compose up -d --force-recreate bot
```

### Logs Deep Dive

```bash
# Follow logs in real-time
docker-compose logs -f bot

# Since timestamp
docker-compose logs --since 2024-01-01T00:00:00 bot

# Last N lines
docker-compose logs --tail=50 bot

# Save to file
docker-compose logs bot > bot-logs.txt
```

### Cleanup

```bash
# Remove stopped containers
docker-compose rm

# Remove volumes (WARNING: deletes data!)
docker-compose down -v

# Clean up system
docker system prune -a
```

### Exec into containers

```bash
# Redis CLI
docker-compose exec redis redis-cli

# Bot shell
docker-compose exec bot sh

# Check bot process
docker-compose exec bot ps aux
```

## 🔧 Redis Commands

```bash
# Inside redis-cli (docker-compose exec redis redis-cli)

# Ping
PING

# DB size
DBSIZE

# Get all keys
KEYS *

# Get key value
GET key_name

# Delete key
DEL key_name

# Flush all
FLUSHALL

# Info
INFO

# Memory usage
INFO memory
```

## 🎯 Grafana Tips

### Shortcuts

- `?` - Show shortcuts
- `Ctrl+K` or `Cmd+K` - Search
- `g h` - Go to home
- `g e` - Go to explore
- `g d` - Go to dashboards

### Useful URLs

```
# Direct dashboard
http://localhost:3000/d/bodymovin-bot-overview

# Explore Prometheus
http://localhost:3000/explore?orgId=1&left=[%22now-1h%22,%22now%22,%22Prometheus%22]

# Explore Loki
http://localhost:3000/explore?orgId=1&left=[%22now-1h%22,%22now%22,%22Loki%22]
```

## 📝 Environment Variables

```bash
# Logging
LOG_LEVEL=debug          # debug, info, warn, error
ENABLE_LOKI=true         # true/false
LOKI_HOST=http://loki:3100

# Metrics
METRICS_PORT=3099

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=supersecret

# Node
NODE_ENV=production      # development/production
```

## 🚨 Common Issues

### Метрики не обновляются

```bash
# Restart Prometheus
docker-compose restart prometheus

# Check targets
curl http://localhost:9099/api/v1/targets | jq
```

### Логи не появляются

```bash
# Check Loki
docker-compose logs loki

# Restart Loki
docker-compose restart loki

# Check connection
curl http://localhost:3100/ready
```

### Grafana не подключается

```bash
# Restart Grafana
docker-compose restart grafana

# Check datasources
docker-compose logs grafana | grep datasource

# Reset admin password
docker-compose exec grafana grafana-cli admin reset-admin-password admin
```

### High memory usage

```bash
# Check memory
docker stats

# Restart bot
docker-compose restart bot

# Check logs for memory leaks
docker-compose logs bot | grep -i "memory\|heap"
```

## 📚 Quick Links

- **Prometheus Docs:** https://prometheus.io/docs/
- **Loki Docs:** https://grafana.com/docs/loki/latest/
- **Grafana Docs:** https://grafana.com/docs/grafana/latest/
- **LogQL:** https://grafana.com/docs/loki/latest/logql/
- **PromQL:** https://prometheus.io/docs/prometheus/latest/querying/basics/
