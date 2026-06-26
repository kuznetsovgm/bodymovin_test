# Telegram Animated Sticker Bot

Telegram бот для создания анимированных текстовых стикеров в inline режиме.

## Возможности

- 🎨 8 различных комбинаций анимаций (Slide, Scale, Rotate, Bounce, Shake + Rainbow/RGB/Pulse)
- ⚡ Автоматическая генерация с задержкой 2 секунды
- 🔄 Автоматический перенос длинных текстов
- 🌀 Кривой и сферический текст: задаёте режим и радиус, и генератор выстраивает буквы вдоль дуги/сферы с нужной перспективой
- 📦 Кэширование сгенерированных стикеров
- 💬 Работает в любом чате через inline режим

## Установка

1. Установите зависимости:

```bash
npm install
```

2. Создайте `.env` файл и добавьте токен бота:

```bash
cp .env.example .env
```

3. Получите токен бота у [@BotFather](https://t.me/BotFather):

   - Создайте нового бота командой `/newbot`
   - Включите inline режим: `/setinline`
   - Скопируйте токен в `.env`

4. Скомпилируйте и запустите бота:

```bash
npm run bot
```

## Использование

1. Откройте любой чат в Telegram
2. Введите `@your_bot_username` и текст
3. Подождите 2 секунды
4. Выберите один из 8 анимированных стикеров

## Примеры анимаций

- **Slide Rainbow** - горизонтальное скольжение с радугой
- **Scale Rainbow** - пульсация размера с радугой
- **Rotate Rainbow** - непрерывное вращение с радугой
- **Bounce Rainbow** - прыжок с радугой
- **Shake RGB** - тряска с RGB переливом
- **Slide Pulse** - скольжение с пульсацией цвета
- **Scale RGB** - масштабирование с RGB
- **Bounce Pulse** - прыжок с пульсацией

## Кривой текст

Конфигурация поддерживает новое свойство `textCurve`, которым можно управлять через UI или JSON:

```json
{
  "textCurve": {
    "mode": "sphere",
    "radius": 400
  }
}
```

`mode` принимает значения `none`, `arc` или `sphere`. В режиме `arc` строки изгибаются по указанной дуге, а `sphere` дополнительно добавляет перспективное масштабирование символов по краям, сохраняя переносы; коэффициент масштабирования (`sphereScaleFactor`) и флаг поворота букв (`rotateLetters`) можно подбирать через UI или вручную в JSON.

## Скрипты

- `npm start` - генерация примеров стикеров
- `npm run bot` - запуск Telegram бота
- `npm run watch` - режим разработки с автоперезагрузкой

## Структура проекта

```
src/
├── index.ts          # Генератор стикеров
├── bot.ts            # Telegram бот
└── interfaces/       # TypeScript интерфейсы
    ├── lottie.ts
    └── sticker.ts
```

## Технологии

- TypeScript
- Telegraf.js
- OpenType.js
- Lottie (Bodymovin)
- Redis (кэширование)
- Worker Threads (параллельная генерация)
- Prometheus (метрики)
- Loki (логи)
- Grafana (визуализация)

## Переменные окружения

Основные переменные:

- `BOT_TOKEN` - токен Telegram бота (обязательно)
- `REDIS_HOST` - хост Redis (по умолчанию: localhost)
- `REDIS_PORT` - порт Redis (по умолчанию: 6379)

Worker pool:

- `WORKER_POOL_SIZE` - количество воркеров для параллельной генерации (по умолчанию: количество CPU)
- `WORKER_QUEUE_SIZE` - максимальный размер очереди задач (по умолчанию: 100)

Inline pipeline:

- `STICKERS_PER_GENERATION_BATCH` - сколько вариантов запускать на генерацию для одного inline batch (по умолчанию: 10)
- `UPLOAD_MIN_INTERVAL_MS` - минимальная пауза между загрузками стикеров в Telegram; сами загрузки всегда идут по одной (по умолчанию: 0)
- `INLINE_FIRST_RESULT_WAIT_MS` - сколько ждать первый сгенерированный и загруженный результат перед быстрым ответом inline query (по умолчанию: 7000)

Мониторинг:

- `METRICS_PORT` - порт для метрик Prometheus (по умолчанию: 3099)

См. `.env.example` для полного списка переменных.

## Мониторинг

Проект экспортирует метрики и логи в внешний monitoring-compose (Prometheus/Loki/Grafana/Promtail) через общую Docker-сеть `quickqueue-shared`.

### Быстрый старт с мониторингом:

```bash
# 1) Убедитесь, что внешний monitoring-compose поднят
#    и использует внешнюю сеть quickqueue-shared

# 2) Запуск стека приложения (бот + Redis + Postgres + Redis Exporter)
docker-compose up -d

# 3) Проверка статуса
docker-compose ps
```

### Доступ к сервисам:

- **Bot Metrics:** http://localhost:3099/metrics
- **Bot Health:** http://localhost:3099/health
- **Grafana / Prometheus / Loki:** из отдельного monitoring-compose

### Доступные метрики:

- Inline queries rate и latency
- Sticker generation duration по типам анимации
- Cache hit/miss rate
- Redis connection status
- Errors rate по типам
- Memory & CPU usage

См. полный список метрик и логов в [MONITORING.md](./MONITORING.md).
