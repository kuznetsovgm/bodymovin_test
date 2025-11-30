# Подсистема фоновых слоёв и «дырки в чат» для стикеров

## 1. Цель и контекст

Система генерирует анимированные стикеры для Telegram на базе Lottie‑анимации. В текущей версии пайплайн умеет:

- рендерить текст одним `ShapeLayer` (контуры глифов + стили + анимации);
- применять к тексту:
  - трансформации (`TransformAnimationDescriptor[]`);
  - анимации букв (`LetterAnimationDescriptor[]`);
  - анимации заливки и обводки (`ColorAnimationDescriptor[]`);
  - path‑morph (`PathMorphAnimationDescriptor[]`).

Новая подсистема должна добавить:

1. Фоновые слои позади текста (заливка, рамка, полоски, шрифтовые паттерны и их комбинации).
2. Специальный «фон‑дырку» — область, через которую прозрачно виден фон чата Telegram, с поддержкой синхронизации с анимацией букв.

Документ описывает требования и целевую архитектуру на уровне доменной модели и пайплайна, достаточную для начала реализации.

## 2. Ограничения Telegram / Lottie

Telegram накладывает ограничения на использованные фичи After Effects / Lottie. НЕЛЬЗЯ использовать:

- Masks
- Merge Paths
- Solids
- Text layers
- Auto‑Bezier keys
- Expressions
- Layer Effects
- Images
- 3D Layers
- Gradient Strokes
- Repeaters
- Time Stretching / Remapping
- Auto‑oriented Layers

Разрешённый поднабор для нас:

- `ShapeLayer` (ty: 4) с:
  - `PathShape` (ty: 'sh');
  - `FillShape` (ty: 'fl');
  - `StrokeShape` (ty: 'st');
  - `TransformShape` (ty: 'tr').
- Анимация через keyframes (без авто‑безье/экспрешенов).

Следствия для фонов:

- Нельзя делать вычитание «прямоугольник минус буквы» через Masks / Merge Paths — boolean‑геометрию нужно просчитать до генерации Lottie.
- Нельзя использовать Text‑слой — текст уже представлен через контуры глифов.
- Прозрачная «дырка в чат» должна быть реализована через форму, у которой **нет fill в областях букв** (прозрачные зоны), а не через маску.

## 3. Текущий пайплайн (упрощённо)

Основные сущности:

- `GenerateStickerOptions` (src/domain/types.ts):
  - `text: string;`
  - анимационные дескрипторы (transform, color, stroke, letter, pathMorph);
  - `fontFile`, размеры, fps, duration, `seed`.
- `generateSticker` / `generateTextSticker` (src/pipeline/generateSticker.ts):
  1. `applyDefaults(opts)` — заполнение дефолтов (размеры, duration, анимации и т.д.).
  2. Загрузка шрифта (`loadFont`) + валидация покрытия текста (`ensureFontSupportsText`).
  3. Обёртка/масштабирование текста (`wrapAndScaleText`).
  4. Лэйаут (`layoutText`) → массив `LaidOutGlyph` (char, glyph, x, y, letterIndex, lineIndex…).
  5. Создание базового `ShapeLayer` (Text Layer) с `ks` (позиция, масштаб, opacity…).
  6. Построение `lettersGroup`:
     - из каждого `LaidOutGlyph` → `glyphToShapes` (PathShape[] на основе opentype glyph);
     - `applyLetterAnimations` + `applyPathMorphAnimations` для path‑анимаций;
     - `buildLetterStyles` → Fill/Stroke с анимацией цвета;
     - группировка каждого символа в `GroupShapeElement` под `lettersGroup`.
  7. Применение layer‑level transform/color animations (`applyTransformsWithCompose`, `applyColorsWithCompose`).
  8. Формирование финального объекта `Sticker` (Lottie JSON).

Пока существует один логический слой: «текстовый» `ShapeLayer`, куда добавляются все формы букв и стили.

## 4. Требования к новой подсистеме фонов

### 4.1. Общие типы фонов

Нужно поддержать несколько **фоновых слоёв**, рисующихся **под текстом**:

- Сплошная заливка (плашка).
- Рамка.
- Полоски.
- Паттерны из спец‑шрифтов (звёздочки, кружочки и т.п.).
- Комбинации выше (несколько слоёв).

Каждый фон:

- описывается декларативно в конфиге/опциях;
- имеет собственный набор анимаций:
  - `transformAnimations` (движение/масштаб слоя);
  - `colorAnimations` / `strokeAnimations` (цвет/обводка фона);
  - `pathMorphAnimations` (деформация контуров);
  - при необходимости — «letter‑подобные» анимации для паттернов (декоративные глифы).

Важно: фоновые слои не должны ломать существующую модель текста; по умолчанию текстовый слой остаётся как есть.

### 4.2. Специальный фон «дырка в чат»

Отдельно требуется **специальный фон**, который:

- даёт настоящую прозрачную «дырку» до фона чата;
- синхронизирован с текстом (анимация букв);
- умеет:
  - вырезать по заливке букв;
  - опционально добавлять обводку по контуру «дырок».

Особенности:

- Это отдельный тип фона (не смешивается с обычными background‑слоями).
- Может быть **только один** на стикер.
- Геометрия «вычитания букв из фона» просчитывается в нашем коде:
  - на уровне Bezier/Path;
  - в Lottie отдаётся уже готовый контур с «дырущимися» областями (например, через многоконтурный path с even‑odd fill).

## 5. Модель данных (дополнения)

### 5.1. Типы и дескрипторы фонов

Новый enum для обычных фоновых слоёв:

```ts
export enum BackgroundLayerType {
    Solid = 'solid',
    Frame = 'frame',
    Stripes = 'stripes',
    GlyphPattern = 'glyphPattern',
    TextLike = 'textLike', // слой, построенный как текст (из шрифта), но используемый как фон
}
```

Дескриптор фонового слоя:

```ts
export type BackgroundLayerDescriptor = {
    type: BackgroundLayerType;

    // Анимации на уровне слоя (аналогично текстовому ShapeLayer)
    transformAnimations?: TransformAnimationDescriptor[];
    colorAnimations?: ColorAnimationDescriptor[];
    strokeAnimations?: ColorAnimationDescriptor[];
    pathMorphAnimations?: AnimationDescriptor<PathMorphAnimationType, PathMorphAnimationParams>[];

    // Для фоновых паттернов на основе шрифтов
    fontFile?: string; // спец‑шрифт для декоративных символов
    text?: string;     // паттерн (звёздочки, кружочки и т.п.)

    // Специализированные параметры конкретного вида фона
    params?: any;      // будет типизировано по BackgroundLayerType позже
};
```

### 5.2. Специальный фон‑дырка

Специальный тип опций:

```ts
export type KnockoutBackgroundMode = 'fill' | 'stroke';

export type KnockoutBackgroundOptions = {
    // Базовая анимация фона (двигается/масштабируется как слой)
    transformAnimations?: TransformAnimationDescriptor[];
    colorAnimations?: ColorAnimationDescriptor[]; // цвет заливки фона
    strokeAnimations?: ColorAnimationDescriptor[]; // цвет/ширина обводки вокруг дыр
    pathMorphAnimations?: AnimationDescriptor<PathMorphAnimationType, PathMorphAnimationParams>[];

    // Режим вырезания:
    // 'fill'  — вырезаем по заливке букв;
    // 'stroke' — вырезаем по «толстой» линии вокруг контура букв (требует расширения геометрии).
    mode: KnockoutBackgroundMode;

    // Геометрия плашки (фонового прямоугольника/формы)
    paddingFactor?: number;    // запас вокруг текста (0..1 от размеров текста/кадра)
    cornerRadiusFactor?: number; // для скруглённых прямоугольников
};
```

Расширение `GenerateStickerOptions`:

```ts
export interface GenerateStickerOptions {
    text: string;
    // существующие поля ...

    // Массив обычных фоновых слоёв
    backgroundLayers?: BackgroundLayerDescriptor[];

    // Специальный фон‑дырка (не более одного)
    knockoutBackground?: KnockoutBackgroundOptions;
}
```

Ограничения:

- `backgroundLayers` — может содержать 0..N слоёв.
- `knockoutBackground` — 0 или 1.
- Логика разрешения коллизий/приоритетов:
  - все `backgroundLayers` рисуются **под** knockout‑фоном;
  - knockout‑фон рисуется под текстом.

## 6. Архитектура пайплайна с фонами

### 6.1. Обновлённый этап generateTextSticker

Порядок действий (внутри `generateTextSticker`):

1. `applyDefaults(opts)` — как сейчас.
2. Загрузка и валидация шрифта текста (`loadFont`, `ensureFontSupportsText`).
3. Расчёт размера шрифта (`resolveFontSize`) и лэйаута (`wrapAndScaleText`, `layoutText`):
   - результат: `layout: LaidOutGlyph[]`, `finalFontSize`.
4. **Создание фоновых слоёв**:
   - `buildBackgroundLayers(layout, finalFontSize, opts.backgroundLayers, ...) → ShapeLayer[]`.
5. **Создание спец‑фона‑дырки** (если указан):
   - `buildKnockoutBackgroundLayer(layout, finalFontSize, opts.knockoutBackground, ...) → ShapeLayer | null`.
6. **Создание текстового слоя**:
   - `buildTextLayer(layout, finalFontSize, opts, ...) → ShapeLayer`.
7. Формирование массива `layers`:
   - `[...backgroundLayers, knockoutLayer?, textLayer]`.
8. Сборка `Sticker` (как сейчас).

### 6.2. Фоновые слои (backgroundLayers)

Функция верхнего уровня:

```ts
function buildBackgroundLayers(
    layout: LaidOutGlyph[],
    finalFontSize: number,
    opts: BackgroundLayerDescriptor[] | undefined,
    context: { width: number; height: number; duration: number; seed: number },
): ShapeLayer[] { ... }
```

Для каждого `BackgroundLayerDescriptor`:

1. Создать базовый `ShapeLayer` аналогичный текущему текстовому (но без букв).
2. Применить `transformAnimations` к `layer.ks` через `applyTransformsWithCompose`.
3. В зависимости от `type`:
   - `Solid`:
     - построить один `GroupShapeElement` с `RectShape` на весь кадр или вокруг текста;
     - построить `FillShape` / `StrokeShape` с использованием `colorAnimations`/`strokeAnimations` (можно переиспользовать `buildLetterStyles` или вынести общую функцию).
   - `Frame`:
     - аналог `Solid`, но рассчитывать размер/толщину рамки из `params` (padding/width);
   - `Stripes`:
     - набор `RectShape`‑полос с разными позициями и, опционально, разными цветами;
   - `GlyphPattern`:
     - загрузить `fontFile` (спец‑шрифт), выполнить собственный layout (сеткой/по кругу) над `text` (паттерн);
     - для каждого символа паттерна → `glyphToShapes` + `applyPathMorphAnimations`;
     - по желанию — свои `letterAnimations` для паттерна (либо отдельный параметр, либо переиспользование имеющихся).
   - `TextLike`:
     - использовать `layout` и текущий `fontFile`/`text`, но только для фонового оформления (например, подложить крупную полупрозрачную копию текста).
4. Собрать shapes в `layer.shapes`.

### 6.3. Специальный фон‑дырка (knockoutBackground)

Функция:

```ts
function buildKnockoutBackgroundLayer(
    layout: LaidOutGlyph[],
    finalFontSize: number,
    opts: KnockoutBackgroundOptions | undefined,
    context: { width: number; height: number; duration: number; seed: number },
): ShapeLayer | null { ... }
```

Обязанности:

1. Если `opts` нет — вернуть `null`.
2. Рассчитать габариты текста по `layout`:
   - `minX, maxX, minY, maxY` с учётом `advance` и `lineHeight`.
3. Построить базовый прямоугольник/форму для фона:
   - расширить габариты текста на `paddingFactor` (либо относительно текста, либо относительно кадра);
   - если нужен скруглённый прямоугольник — записать это в `RectShape.r`.
4. Получить контуры букв:
   - для каждого `LaidOutGlyph` использовать `glyphToShapes(glyph, char, letterIndex, …)` с тем же `fontSize` и `pathMorphAnimations`, что и для текста, **либо** с отдельной копией path‑анимаций (в зависимости от требований синхронизации);
   - важно: контуры букв должны быть в тех же координатах, что и фон (слой позиционируется по центру кадра).
5. Сформировать единую «многоконтурную» фигуру:
   - составить один или несколько `PathShape`, где:
     - первый контур — прямоугольник (фон);
     - последующие контуры — буквы;
   - при использовании `FillRule.EvenOdd` (r = FillRule.EvenOdd) это даст эффект «дырки» в местах букв.
6. Построить `FillShape` для фона:
   - на основе `colorAnimations` → заливка фона;
   - `r` установить в `FillRule.EvenOdd`.
7. Если `strokeAnimations` заданы:
   - построить `StrokeShape`, который обводит внешний контур и контуры букв:
     - либо на тех же path’ах, либо на отдельных path’ах только по буквам (требует выбора на уровне дизайна).
8. Создать `ShapeLayer`:
   - `ks` инициализировать как у текстового слоя (позиция по центру);
   - применить `transformAnimations` через `applyTransformsWithCompose`;
   - `shapes` = `[GroupShapeElement { it: [PathShape(s), FillShape, StrokeShape?] }]`.

Анимация букв на knockout‑фоне:

- Простой уровень:
  - контуры букв на фоне используют те же статические формы, что и текст;
  - весь слой фона анимируется трансформ‑анимациями (scale/bounce/rotate), синхронно с текстовым слоем (за счёт одинаковых `transformAnimations`).
- Расширенный уровень (в будущем):
  - повторить `LetterAnimationDescriptor[]` и `PathMorphAnimationDescriptor[]` для контуров букв на фоне, чтобы дырки «жили» так же, как текст (typingFall, wave и т.п.);
  - для этого можно переиспользовать `applyLetterAnimations` и `applyPathMorphAnimations` с тем же `LetterContext`, что у текста.

## 7. Взаимодействие с конфиг‑UI и API

### 7.1. API backend

Новые поля в `GenerateStickerOptions` автоматически подхватываются:

- `/api/preview` — принимает `config: Omit<GenerateStickerOptions, 'text'>`, поэтому:
  - нужно расширить сериализацию/десериализацию в `public/config.js`, чтобы там появилось:
    - редактирование `backgroundLayers`;
    - редактирование `knockoutBackground`.

Отдельного API для фонов не требуется, кроме, возможно, вспомогательных (например, список доступных спец‑шрифтов для паттернов).

### 7.2. Конфиг‑UI (public/config.js)

На уровне UI:

- Добавить секцию управления фонами:
  - `backgroundType` (select: none/solid/frame/stripes/glyphPattern/textLike);
  - `backgroundParams` (формы, padding, counts и т.п.);
  - `backgroundFontFile` (для glyph/text‑based фона).
- Добавить секцию для knockout‑фона:
  - включение/выключение;
  - параметры:
    - цвет заливки (анимация);
    - режим `mode: fill|stroke`;
    - padding/cornerRadius;
    - опционально: «использовать те же transform/letter/pathMorph анимации, что у текста».

UI‑часть не входит в первичное ТЗ по реализации ядра, но должна быть совместима с моделью данных.

## 8. План реализации (высокоуровневый)

1. **Доменные типы**
   - Расширить `src/domain/types.ts`:
     - добавить `BackgroundLayerType`, `BackgroundLayerDescriptor`, `KnockoutBackgroundOptions`;
     - добавить поля `backgroundLayers?`, `knockoutBackground?` в `GenerateStickerOptions`.
   - Обновить `applyDefaults` при необходимости (установить `backgroundLayers`/`knockoutBackground` в `undefined` по умолчанию).

2. **Пайплайн фонов**
   - В `src/pipeline/generateSticker.ts`:
     - вынести существующую логику текста в `buildTextLayer(...)`;
     - реализовать `buildBackgroundLayers(...)` (пока минимум `Solid`, остальное — поэтапно);
     - реализовать `buildKnockoutBackgroundLayer(...)` (минимальный вариант: прямоугольник + контуры букв, even‑odd fill, без сложных букво‑анимаций);
     - формировать `layers` как комбинацию фоновых слоёв, knockout‑слоя и текстового слоя.

3. **Интеграция с анимациями**
   - Переиспользовать `applyTransformsWithCompose`, `applyColorsWithCompose`, `applyPathMorphAnimations`, `applyLetterAnimations` для фоновых слоёв там, где это логично.
   - Выделить общие хелперы для построения Fill/Stroke из `ColorAnimationDescriptor` (частично уже есть в `buildLetterStyles`).

4. **Расширение видов фона**
   - Добавить реализацию `Frame`, `Stripes`.
   - Добавить `GlyphPattern` / `TextLike` на базе существующих layout/glyph‑утилит, с поддержкой спец‑шрифтов.

5. **UI / конфиги**
   - Расширить `public/config.js` и `src/init-configs.ts` для параметризации фонов.
   - При необходимости — добавить подсветку неподдерживаемых фоновых комбинаций.

## 9. Открытые вопросы / уточнения

1. **Точное поведение FillRule / even‑odd в Telegram**
   - Требуется тест, что многоконтурный path с even‑odd fill действительно создаёт прозрачные «дырки» до фона чата.
2. **Режим `KnockoutBackgroundMode = 'stroke'`**
   - Нужна ли в первой версии поддержка вырезания по «толстой линии» (stroke) или достаточно вырезания по заполненной области букв?
3. **Синхронизация букво‑анимаций для knockout‑фона**
   - Нужна ли точная копия `LetterAnimationDescriptor[]`/`PathMorphAnimationDescriptor[]` на контуры фона или достаточно layer‑level анимаций (движение/масштаб целиком)?
4. **Взаимодействие с несколькими текстовыми слоями**
   - В долгосрочной перспективе может появиться несколько текстовых блоков в одном стикере; тогда knockout‑фон должен учитывать их объединённые габариты/контуры.

Этот документ задаёт общую архитектуру и интерфейсы. Реализацию можно вести поэтапно: сначала базовый `Solid` фон и простой `KnockoutBackground` без сложных букво‑анимаций, затем добавлять остальные типы фоновых слоёв и углублённую синхронизацию анимаций.

## 10. Текущее состояние реализации (обновлять по мере прогресса)

- Типы и опции расширены: `backgroundLayers`, `knockoutBackground`.
- Реализованы базовые фоновые слои в пайплайне: `Solid`, `Frame`, `Stripes` (как отдельные `ShapeLayer` под текстом). Для них доступны scale/rotation/opacity, padding/cornerRadius; `Stripes` красится полосами с фазовым сдвигом цвета.
- Реализован базовый `knockoutBackground`: плашка + контуры букв в одном `ShapeLayer` с `FillRule.EvenOdd` (вырезается по заливке); поддерживаются layer‑level transform/color/pathMorph анимации, fill/ stroke для плашки; scale/rotation/opacity на уровне слоя. Пер‑буквенные анимации (в стиле `LetterAnimationDescriptor`) пока не применяются к дыркам. Одновременное использование `knockoutBackground` и обычных `backgroundLayers` запрещено (бросается ошибка).
- Реализованы `GlyphPattern` (паттерн из спец‑шрифтов, сетка, spacing, цветовая фаза) и `TextLike` (копия текста или заданный текст, с фазой цвета), с поддержкой scale/rotation/opacity.
- Отличия `GlyphPattern` vs `TextLike`: `GlyphPattern` использует отдельный спец‑шрифт и собственный текст/паттерн, тиражируемый сеткой; `TextLike` использует основной или указанный шрифт и текст (по умолчанию основной), рисуя его как фон без сетки.
- Следующая итерация: добавить “безопасный” профиль анимаций фона (мягкие эффекты), поддержать паттерны из шрифтов и пер‑буквенные анимации в дырке при необходимости.
