# Quick Start Guide

## Запуск в Docker

### 1. Подготовка

Создайте `.env` файл:

```bash
cp .env.example .env
```

Отредактируйте `.env` и добавьте ваш BOT_TOKEN:

```bash
BOT_TOKEN=your_actual_bot_token_here
UPLOAD_CHAT_IDS=your_chat_id
ADMIN_USER_IDS=your_user_id
```

### 2. Запуск

```bash
# Запустить весь стек (бот, Redis, Prometheus, Loki, Grafana)
docker-compose up -d

# Проверить статус
docker-compose ps

# Просмотр логов бота
docker-compose logs -f bot
```

### 3. Доступ к сервисам

После запуска откройте в браузере:

- **Grafana Dashboard:** http://localhost:3000
  - Логин: `admin`
  - Пароль: `admin` (или из `.env`)
- **Prometheus:** http://localhost:9099
- **Bot Metrics:** http://localhost:9095/metrics

- **Bot Health Check:** http://localhost:9095/health

### 4. Использование бота

1. Откройте Telegram
2. Напишите в любом чате: `@your_bot_username hello`
3. Подождите 2 секунды
4. Выберите стикер из предложенных

### 5. Мониторинг

Откройте Grafana (http://localhost:3000) и выберите дашборд "Bodymovin Bot Overview"

Вы увидите:

- График inline queries
- Время генерации стикеров
- Cache hit rate
- Ошибки
- Статус Redis
- Memory/CPU usage

### 6. Просмотр логов

```bash
# Все логи
docker-compose logs -f

# Только бот
docker-compose logs -f bot

# Только ошибки бота
docker-compose logs -f bot | grep -i error
```

### 7. Остановка

```bash
# Остановить все сервисы
docker-compose down

# Остановить и удалить данные (volumes)
docker-compose down -v
```

## Локальная разработка (без Docker)

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка .env

```bash
cp .env.example .env
```

Отредактируйте `.env`:

```bash
BOT_TOKEN=your_bot_token
REDIS_URL=redis://localhost:6379
NODE_ENV=development
ENABLE_LOKI=false
LOG_LEVEL=debug
```

### 3. Запуск Redis

```bash
# Если установлен Redis локально
redis-server

# Или через Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### 4. Запуск бота

```bash
npm run bot
```

### 5. Режим разработки с hot reload

```bash
npm run watch
```

## Команды администратора

Если ваш Telegram ID указан в `ADMIN_USER_IDS`, вы можете использовать:

### Управление конфигурациями стикеров

```
/list_configs - показать все конфигурации
/enable_config <id> - включить конфигурацию
/disable_config <id> - выключить конфигурацию
/enable_all - включить все
/disable_all - выключить все
```

### Управление чатами для загрузки

```
/list_upload_chats - показать текущие чаты
/set_upload_chats <id1>,<id2>,<id3> - установить чаты
/add_upload_chat <id> - добавить чат
/remove_upload_chat <id> - удалить чат
```

### Настройки

```
/set_debounce_delay <ms> - установить задержку (например, 2000)
/get_config - показать текущие настройки
```

### Управление кэшем

```
/cache_stats - статистика кэша
/clear_cache - очистить весь кэш
/clear_text_cache <text> - очистить кэш для текста
```

## Troubleshooting

### Бот не отвечает

1. Проверьте, что бот запущен:

   ```bash
   docker-compose ps bot
   ```

2. Проверьте логи:

   ```bash
   docker-compose logs bot
   ```

3. Проверьте BOT_TOKEN в `.env`

### Стикеры не загружаются

1. Убедитесь, что указаны `UPLOAD_CHAT_IDS` в `.env`
2. Бот должен быть добавлен в эти чаты с правами отправки сообщений
3. Проверьте логи загрузки:
   ```bash
   docker-compose logs bot | grep -i upload
   ```

### Redis connection error

1. Проверьте, что Redis запущен:

   ```bash
   docker-compose ps redis
   ```

2. Проверьте подключение:
   ```bash
   docker-compose exec redis redis-cli ping
   ```

### Метрики не отображаются

1. Проверьте endpoint:

   ```bash
   curl http://localhost:9099/metrics
   ```

2. Проверьте targets в Prometheus:
   http://localhost:9099/targets

3. Проверьте логи Prometheus:
   ```bash
   docker-compose logs prometheus
   ```

### Логи не появляются в Loki

1. Проверьте, что `ENABLE_LOKI=true` в `.env`
2. Проверьте статус Loki:
   ```bash
   docker-compose logs loki
   curl http://localhost:3100/ready
   ```

## Полезные команды

### Docker

```bash
# Пересобрать образ бота
docker-compose build bot

# Перезапустить только бот
docker-compose restart bot

# Просмотр использования ресурсов
docker stats

# Очистка Docker
docker system prune -a
```

### Prometheus queries (в Grafana Explore)

```promql
# Rate inline queries
rate(bot_inline_queries_total[5m])

# 95th percentile generation time
histogram_quantile(0.95, rate(bot_sticker_generation_duration_seconds_bucket[5m]))

# Cache hit rate
rate(bot_cache_hits_total[5m]) / (rate(bot_cache_hits_total[5m]) + rate(bot_cache_misses_total[5m]))
```

### Loki queries (в Grafana Explore)

```logql
# Все логи бота
{app="bodymovin-bot"}

# Только ошибки
{app="bodymovin-bot"} |= "error"

# События генерации
{app="bodymovin-bot"} | json | event="sticker_generation"
```

## Дополнительно

- [MONITORING.md](./MONITORING.md) - Подробная документация по мониторингу
- [DOCKER.md](./DOCKER.md) - Документация Docker setup
- [docs/redis-config.md](./docs/redis-config.md) - Redis конфигурация
