# Docker Setup Guide

## Требования

- Docker
- Docker Compose

## Быстрый старт

1. **Создайте файл .env** (если его нет):

   ```bash
   cp .env.example .env
   ```

2. **Добавьте ваш BOT_TOKEN** в файл `.env`:

   ```
   BOT_TOKEN=your_telegram_bot_token_here
   REDIS_URL=redis://redis:6379
   ```

3. **Запустите проект**:
   ```bash
   docker-compose up -d
   ```

## Команды

### Запуск сервисов

```bash
docker-compose up -d
```

### Остановка сервисов

```bash
docker-compose down
```

### Просмотр логов

```bash
docker-compose logs -f bot
docker-compose logs -f redis
```

### Перезапуск после изменений кода

```bash
docker-compose up -d --build
```

### Очистка всех данных

```bash
docker-compose down -v
```

## Структура

- **bot** - основной сервис с Telegram ботом
- **redis** - Redis для кеширования стикеров

## Порты

- Redis: `6379` (доступен на localhost:6379)

## Volumes

- `redis-data` - данные Redis
- `./stickers` - сгенерированные стикеры
- `./temp` - временные файлы
- `./public` - публичные файлы
- `./fonts` - шрифты

## Отладка

### Войти в контейнер бота

```bash
docker-compose exec bot sh
```

### Проверить статус Redis

```bash
docker-compose exec redis redis-cli ping
```

### Просмотреть ключи в Redis

```bash
docker-compose exec redis redis-cli KEYS "sticker:*"
```
