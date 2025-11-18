# Генератор Telegram стикеров из текста

## Описание

Функция `generateTextSticker` создает Lottie-анимацию для Telegram стикера из текстовой строки.

## Использование

```typescript
import {
  generateTextSticker,
  AnimationType,
  saveStickerToFile,
} from './src/index';

// Создание статичного стикера
const staticSticker = await generateTextSticker({
  text: 'Привет',
  animationType: AnimationType.Static,
  fontSize: 72,
});

// Создание стикера с анимацией смены цвета
const animatedSticker = await generateTextSticker({
  text: 'Hello',
  animationType: AnimationType.ColorChange,
  fontSize: 80,
  width: 512,
  height: 512,
  frameRate: 60,
  duration: 180,
});

// Сохранение в файл .tgs
await saveStickerToFile(staticSticker, './stickers/my_sticker.tgs');

// Сохранение в JSON для отладки
await fs.writeFile(
  './stickers/debug.json',
  JSON.stringify(staticSticker, null, 2),
);
```

## Параметры

### GenerateStickerOptions

| Параметр        | Тип             | По умолчанию                  | Описание                  |
| --------------- | --------------- | ----------------------------- | ------------------------- |
| `text`          | `string`        | **обязательный**              | Текст для стикера         |
| `animationType` | `AnimationType` | `Static`                      | Тип анимации              |
| `fontSize`      | `number`        | `72`                          | Размер шрифта             |
| `fontPath`      | `string`        | `'./fonts/CyrillicRound.ttf'` | Путь к файлу шрифта       |
| `width`         | `number`        | `512`                         | Ширина стикера в пикселях |
| `height`        | `number`        | `512`                         | Высота стикера в пикселях |
| `frameRate`     | `number`        | `60`                          | Частота кадров            |
| `duration`      | `number`        | `180`                         | Длительность в кадрах     |

### AnimationType

- `Static` - статичный текст без анимации
- `ColorChange` - анимация смены цвета (красный → синий → красный)
- `FadeIn` - появление текста (пока не реализовано)

## Функции

### `generateTextSticker(options: GenerateStickerOptions): Promise<Sticker>`

Генерирует объект Lottie-анимации для Telegram стикера.

### `saveStickerToFile(sticker: Sticker, outputPath: string): Promise<void>`

Сохраняет стикер в сжатый файл .tgs (gzip JSON).

## Пример запуска

```bash
npm run start
```

Это создаст файлы:

- `./stickers/hello.tgs` - готовый стикер для Telegram
- `./stickers/hello.json` - несжатый JSON для отладки

## Требования

- OpenType шрифт (.ttf файл)
- Node.js с поддержкой TypeScript
- Установленные зависимости: `opentype.js`, `zlib`

## Формат .tgs

Telegram стикеры используют формат .tgs - это gzip-сжатый JSON файл с Lottie-анимацией.
Требования Telegram:

- Размер: 512x512 пикселей
- Длительность: до 3 секунд
- Размер файла: до 64 КБ
