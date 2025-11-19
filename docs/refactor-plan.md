# План рефакторинга генератора стикеров (развёрнутый)

## Цели

- Разделить ответственность по модулям (домен, layout, геометрия, анимации, стиль, пайплайн, I/O).
- Позволить комбинировать несколько анимаций в одном канале через функции-композиторы.
- Добавить новые трансформы (skew) и сделать добавление новых анимаций/стилей без правки ядра.
- Сохранить детерминированность (seed); примеры будут пересобраны на новом API.
- Полностью избавиться от легаси-API: сразу использовать новый формат опций.

## Структура каталогов (предлагаемая)

- `src/domain/` — типы, дефолты.
- `src/shared/` — утилиты (keyframes, noise, fs).
- `src/layout/` — шрифты, перенос, раскладка.
- `src/shapes/` — bezier, конвертация глифов + morph-хелперы.
- `src/style/` — fill/stroke/palette.
- `src/animations/` — реестры + композиторы.
- `src/pipeline/` — orchestrator.
- `src/io/` — экспорт.
- `examples/` — пресеты/скрипты генерации.

Пример дерева:

```
src/
  domain/
    types.ts
    defaults.ts
  shared/
    keyframes.ts
    noise.ts
    fs.ts
  layout/
    fontLoader.ts
    wrap.ts
    layoutText.ts
  shapes/
    bezier.ts
    glyphToShapes.ts
  style/
    fill.ts
    stroke.ts
    palette.ts
  animations/
    transform.ts
    color.ts
    letter.ts
    pathMorph.ts
    composers.ts
  pipeline/
    generateSticker.ts
  io/
    export.ts
examples/
  generate-presets.ts
```

## Базовые решения

- Совместимость с текущим API не сохраняем: `GenerateStickerOptions` сразу в новом формате (массивы `AnimationDescriptor[]`).
- Все доменные типы и enum-ы хранятся в `src/domain/types.ts`.
- Весь рандом проходит через `seededNoise` / `buildLetterSeed`; глобальный `seed` задаётся в опциях.
- Keyframes имеют единый контракт в `src/shared/keyframes.ts`; композиторы работают только с этими типами.
- `src/index.ts` превращается в тонкую обвязку: экспорт `generateSticker` + CLI/скрипт примеров.

## Шаги реализации (подробно)

1. **Домен**

   - `src/domain/types.ts`:
     - `Sticker` (вынести из `index.ts`).
     - Перечисления: `TransformAnimationType`, `ColorAnimationType`, `LetterAnimationType`, `PathMorphAnimationType`.
     - `type ComposeFn<TPatch, TCtx = any> = (base: TPatch, next: TPatch, ctx: TCtx) => TPatch;`
     - `type AnimationDescriptor<TType, TParams = any> = { type: TType; params?: TParams; compose?: ComposeFn<any>; priority?: number; phase?: number; window?: { start: number; end: number }; };`
     - Новый `GenerateStickerOptions`:
       - `text: string;`
       - `transformAnimations?: AnimationDescriptor<TransformAnimationType>[];`
       - `letterAnimations?: AnimationDescriptor<LetterAnimationType>[];`
       - `colorAnimations?: AnimationDescriptor<ColorAnimationType>[];`
       - `strokeAnimations?: AnimationDescriptor<ColorAnimationType>[];`
       - `pathMorphAnimations?: AnimationDescriptor<PathMorphAnimationType>[];`
       - геометрия/время: `width`, `height`, `frameRate`, `duration`, `fontSize`, `fontPath`, `seed?`;
       - стиль: `strokeWidth`, `strokeColor`, `fillColor`.
   - `src/domain/defaults.ts`:
     - дефолты размера/цвета/fps/duration/пути к шрифту/seed-а;
     - `applyDefaults(opts: Partial<GenerateStickerOptions>): GenerateStickerOptions`.

2. **Shared утилиты**

   - `src/shared/keyframes.ts`:
     - Типы:
       - `type Keyframe<T extends number | number[]> = { t: number; s: T; e?: T; i?: any; o?: any; };`
       - `type Track<T extends number | number[]> = { a: 0 | 1; k: T | Keyframe<T>[]; };`
     - Функции построения:
       - `buildRawTrack<T extends number | number[]>(points: T[], times: number[], loop: boolean): Keyframe<T>[];`
       - `buildScalarTrack(values: number[], times: number[], loop: boolean);`
       - `buildVecTrack(values: number[][], times: number[], loop: boolean);`
       - easing: `linearIn`, `linearOut`.
     - Операции над треками:
       - `sumKF`, `sumVecKF`;
       - `lerpKF`, `lerpVecKF`;
       - `stitchKF(trackA, trackB)` для таймлайнов.
   - `src/shared/noise.ts`:
     - `seededNoise(seed: number, salt?: number): number;`
     - `buildLetterSeed(letterIndex: number, charCode: number, globalSeed: number): number;`
   - `src/shared/fs.ts`:
     - `ensureDir(p: string);`
     - `writeJsonGz(obj: any, outPath: string);`

3. **Layout**

   - `layout/fontLoader.ts`:
     - кешировать opentype-шрифты по пути;
     - `loadFont(path: string): Promise<Font>`.
   - `layout/wrap.ts`:
     - `wrapAndScaleText(text, font, initialFontSize, maxW, maxH) -> { lines: string[]; finalFontSize: number }`;
     - логика переносов из текущего `wrapAndScaleText` без побочек.
   - `layout/layoutText.ts`:
     - вход: `lines`, `font`, `fontSize`;
     - выход: массив `{ char, glyph, x, y, advance, lineIndex, letterIndex }[]`.

4. **Shapes и path morph**

   - `shapes/bezier.ts`:
     - `convertOpentypePathToBezier(path): Bezier;`
     - `warpHandle`, `warpCornerMorph`, `warpCornerMorphAiry`.
   - `shapes/glyphToShapes.ts`:
     - тип для статического `PathShape` без анимаций;
     - `buildPathMorphTrack(bez: Bezier, params, ctx): Track<Bezier>`:
       - внутри использует `warpCornerMorph` / `warpCornerMorphAiry` по `PathMorphAnimationType`;
       - использует `seed` и индекс контура.
     - `glyphsToShapes(layout, font, fontSize, pathMorphDescs, ctx): PathShape[]`:
       - создаёт `PathShape` и, если есть path morph-дескрипторы, навешивает анимированный `ks`.

5. **Стиль**

   - `style/fill.ts`:
     - `createFillTrack(colorDescs, baseColor, ctx) -> Track<[number, number, number, number]>;`
   - `style/stroke.ts`:
     - аналогично: `createStrokeTrack(strokeDescs, baseColor, strokeWidth, ctx);`
   - `style/palette.ts`:
     - пресеты палитр/градиентов (по необходимости).

6. **Анимации и композиторы**

   - Общий контекст:
     - базовый: `{ duration, frameRate, w, h, seed }`;
     - для букв: `+ { letterIndex, lineIndex }`;
     - для path morph: `+ { glyphIndex, contourIndex }`.
   - `animations/transform.ts`:
     - `type TransformPatch = Partial<ShapeLayer['ks']>;`
     - аплаеры: `SlideLoop`, `ScalePulse`, `RotateContinuous`, `ShakeLoop`, `Bounce`, `Vibrate`, `SkewPulse`, `SkewSwing`;
     - `transformRegistry: Record<TransformAnimationType, (ctx) => TransformPatch>`.
   - `animations/letter.ts`:
     - аплаеры per-letter, возвращающие `TransformPatch` (Vibrate, TypingFall, Wave, ZigZag).
   - `animations/color.ts`:
     - аплаеры, возвращающие `Track<[number, number, number, number]>` (CycleRGB, Pulse, Rainbow, Static).
   - `animations/pathMorph.ts`:
     - аплаеры, возвращающие `Track<Bezier>`; используют helpers из `shapes/bezier.ts`.
   - `animations/composers.ts`:
     - Transform:
       - `additiveTransform` (по осям p/s/r/sk/sa суммирует/комбинирует);
       - `blendTransform(weightNext)`;
       - `priorityTransform(minPriority)`;
       - `timelineTransform`.
     - Color/Stroke:
       - `blendColor(weightNext)`;
       - `timelineColor`.
     - PathMorph:
       - `sequentialMorph` (последовательное применение);
       - `blendMorph` (усреднение контрольных точек).
   - Применение дескрипторов (reduce по массивам):
     - `applyTransformAnimations(descs, baseKs, ctx);`
     - `applyLetterAnimations(letters, descs, ctxPerLetter);`
     - `applyColorAnimations(descs, baseColor, ctx);`
     - `applyPathMorphAnimations(shapes, descs, ctx);`

7. **Пайплайн**

   - `pipeline/generateSticker.ts`:
     1. `const cfg = applyDefaults(opts);`
     2. `const ctx = buildContext(cfg); // { duration, frameRate, w, h, seed }`
     3. `font = loadFont(cfg.fontPath);`
     4. `wrapped = wrapAndScaleText(cfg.text, font, cfg.fontSize, cfg.width * 0.85, cfg.height * 0.85);`
     5. `layout = layoutText(wrapped.lines, font, wrapped.finalFontSize);`
     6. `pathShapes = glyphsToShapes(layout, font, wrapped.finalFontSize, cfg.pathMorphAnimations, ctx);`
     7. `styled = applyStyles(pathShapes, cfg.colorAnimations, cfg.strokeAnimations, ctx);`
     8. `letters = applyLetterAnimations(styled, cfg.letterAnimations, ctx);`
     9. `layerKs = applyTransformAnimations(cfg.transformAnimations, baseLayerKs, ctx);`
     10. `sticker = composeSticker(letters, layerKs, cfg);`
   - Публичный API:
     - `export async function generateSticker(opts: GenerateStickerOptions): Promise<Sticker>;`

8. **I/O и примеры**

   - `io/export.ts`:
     - `saveStickerToFile(sticker, outJsonPath, outTgsPath?)` (json + gzip).
   - `examples/generate-presets.ts`:
     - набор пресетов (аналог `init` из текущего `index.ts`), но на новом API:
       - примеры комбинаций transform/letter/color/pathMorph-анимаций;
       - использование `window` и композиторов для таймлайнов.
   - `src/index.ts`:
     - `export * from './pipeline/generateSticker';`
     - опционально CLI: `if (require.main === module) runPresetsCLI();`.

9. **Миграция (с учётом отказа от легаси)**

   - Шагами переносить код из `src/index.ts`:
     - сначала утилиты (`keyframes`, `noise`, `wrap`, `glyph/bezier`, I/O) в соответствующие модули без изменения поведения;
     - затем реализовать домен и новый пайплайн `generateSticker` с массивами `AnimationDescriptor[]`;
     - переписать примеры на новый API;
     - удалить старые enum-ы/опции/`generateTextSticker` после стабилизации нового пути.
   - Все `switch` по enum-ам анимаций постепенно заменить на вызовы реестров + композиторы.

10. **Проверки и тесты**

- Обновить примеры `.tgs/.json` через новый `examples/generate-presets.ts`.
- Добавить unit-тесты:
  - для `shared/keyframes` (sum/lerp/stitch для скаляров/векторов);
  - для `layout/wrap` и `layout/layoutText` (корректный перенос/координаты);
  - для `animations/composers` (additive/blend/priority/timeline);
  - хотя бы один path morph-аплаер (Warp/WarpAiry) на детерминированность и отсутствие артефактов.

## Примеры использования (новый API)

### Комбинация трансформов (scale + shake + skew)

```ts
transformAnimations: [
  { type: TransformAnimationType.ScalePulse, compose: blendTransform(0.5) },
  { type: TransformAnimationType.ShakeLoop,  compose: blendTransform(0.3) },
  { type: TransformAnimationType.SkewPulse,  compose: blendTransform(0.2), params: { intensity: 14 } },
],
```

### Комбинация letter-анимаций (typingFall + zigzag)

```ts
letterAnimations: [
  { type: LetterAnimationType.TypingFall, compose: priorityTransform(10) },
  { type: LetterAnimationType.ZigZag, compose: additiveTransform },
],
```

### Стыковка по времени (timeline)

```ts
colorAnimations: [
  { type: ColorAnimationType.Pulse,   window: { start: 0,              end: duration / 2 }, compose: timelineColor },
  { type: ColorAnimationType.Rainbow, window: { start: duration / 2,   end: duration      }, compose: timelineColor },
],
```

### Path morph как последовательные фильтры

```ts
pathMorphAnimations: [
  { type: PathMorphAnimationType.Warp,     compose: sequentialMorph },
  { type: PathMorphAnimationType.WarpAiry, compose: sequentialMorph, params: { intensity: 0.8 } },
],
```

### Дефолтные композиторы (если не заданы)

- Transform: `additiveTransform` (по осям p/s/r/sk/sa суммирует или берёт патч, если форматы не совпадают).
- Letter: `additiveTransform` на позицию/масштаб/ротацию/скев; `priorityTransform` доступен через `compose`.
- Color/Stroke: `blendColor` (если есть веса) или `timelineColor` (если есть окна).
- PathMorph: `sequentialMorph` (apply A, потом B), `blendMorph` — если нужно усреднение контрольных точек.

## Мини чек-лист имплементации

- [x] Домен создан (`types.ts`, `defaults.ts`), старые интерфейсы удалены из `index.ts`.
- [x] Утилиты keyframes/noise/fs вынесены, все анимации используют их; `Math.random` не используется.
- [x] Layout вынесен (wrap, fontLoader, layoutText) и покрыт базовыми тестами.
- [x] Shapes и path morph вынесены (bezier, glyphToShapes, buildPathMorphTrack).
- [x] Fill/Stroke вынесены и работают с `colorAnimations`/`strokeAnimations`.
- [x] Реестры анимаций созданы, добавлены skew-анимации; все switch-и по enum-ам заменены на вызовы реестров.
- [x] Композиторы реализованы и используются в reduce (transform/letter/color/pathMorph).
- [x] Пайплайн пересобран, `src/index.ts` упрощён до экспорта `generateSticker` и/или CLI.
