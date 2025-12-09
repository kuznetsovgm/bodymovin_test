(() => {
    const uiBaseUrl = new URL(window.location.href);
    const state = {
        meta: null,
        variants: [],
        activeId: null,
        lottieInstance: null,
        dotLottieInstance: null,
        dotLottieUrl: null,
        initialized: false,
        backgroundLayers: [],
        activeBackgroundIndex: null,
        knockout: null,
        backgroundMode: 'layers',
        previewViewport: {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            dragging: false,
            startX: 0,
            startY: 0,
            startOffsetX: 0,
            startOffsetY: 0,
        },
        previewTheme: 'checker',
        textTransform: {
            scale: 1,
            rotationDeg: 0,
            offsetX: 0,
            offsetY: 0,
        },
        activeOverlayTarget: 'text',
        variantPreview: {
            activeId: null,
            instance: null,
            url: null,
            timeoutId: null,
            canvas: null,
            container: null,
        },
        localColorPalette: [],
        localPaletteLoaded: false,
        autoPreview: false,
    };
    const MIN_DURATION_FRAMES = 2;

    const transformSchema = {
        none: {},
        slideLoop: { amplitudeXFactor: 'number' },
        scalePulse: { minScale: 'number', maxScale: 'number' },
        shakeLoop: { steps: 'number', intensity: 'number' },
        bounce: {
            heightAmplitudeFactor: 'number',
            secondaryBounceFactor: 'number',
        },
        vibrate: { steps: 'number', intensity: 'number' },
    };

    const colorSchema = {
        none: {
            colors: 'vec4Array',
            times: 'numberArray',
            loop: 'boolean',
        },
        zebra: {
            colors: 'vec4Array',
            times: 'numberArray',
            loop: 'boolean',
        },
        chase: {
            colors: 'vec4Array',
            times: 'numberArray',
            loop: 'boolean',
            windowFraction: 'number',
            reverse: 'boolean',
        },
        cycleRGB: {
            colors: 'vec4Array',
            times: 'numberArray',
            loop: 'boolean',
        },
        rainbow: {
            colors: 'vec4Array',
            times: 'numberArray',
            loop: 'boolean',
            windowFraction: 'number',
        },
    };

    const letterSchema = {
        none: {},
        vibrate: { intensity: 'number', steps: 'number' },
        typingFall: {
            delayPerLetterFactor: 'number',
            fallDurationFactor: 'number',
            startYOffsetFactor: 'number',
        },
        wave: {
            amplitude: 'number',
            steps: 'number',
            phasePerLetter: 'number',
        },
        zigzag: {
            spread: 'number',
            steps: 'number',
            phasePerLetter: 'number',
            baseScale: 'number',
        },
        rotate: {
            fromAngle: 'number',
            toAngle: 'number',
            loop: 'boolean',
        },
        snakeScale: {
            windowSize: 'number',
            minScale: 'number',
            maxScale: 'number',
            steps: 'number',
            reverse: 'boolean',
        },
    };

    const pathMorphSchema = {
        none: {},
        warp: {
            intensityFactor: 'number',
            phases: 'numberArray',
        },
        warpAiry: {
            intensityFactor: 'number',
            phases: 'numberArray',
            lowFrequency: 'number',
            highFrequency: 'number',
            scaleFactor: 'number',
            rotationFactor: 'number',
        },
        skewPulse: {
            intensityFactor: 'number',
            skewNormDivisor: 'number',
            skewMin: 'number',
            skewMax: 'number',
            skewBase: 'number',
        },
        skewSwing: {
            intensityFactor: 'number',
            skewNormDivisor: 'number',
            skewMin: 'number',
            skewMax: 'number',
            skewBase: 'number',
            swingAmplitudeScale: 'number',
        },
    };

    const backgroundParamSchema = {
        solid: {
            paddingFactor: 'number',
            cornerRadius: 'number',
            scale: 'number',
            rotationDeg: 'number',
            opacity: 'number',
            offsetX: 'number',
            offsetY: 'number',
        },
        frame: {
            paddingFactor: 'number',
            cornerRadius: 'number',
            scale: 'number',
            rotationDeg: 'number',
            opacity: 'number',
            offsetX: 'number',
            offsetY: 'number',
        },
        stripes: {
            count: 'number',
            stripeHeightFactor: 'number',
            gapFactor: 'number',
            cornerRadius: 'number',
            colorPhaseStep: 'number',
            scale: 'number',
            rotationDeg: 'number',
            opacity: 'number',
            offsetX: 'number',
            offsetY: 'number',
        },
        glyphPattern: {
            paddingFactor: 'number',
            cornerRadius: 'number',
            gridColumns: 'number',
            gridRows: 'number',
            spacingXFactor: 'number',
            spacingYFactor: 'number',
            colorPhaseStep: 'number',
            scale: 'number',
            rotationDeg: 'number',
            opacity: 'number',
            offsetX: 'number',
            offsetY: 'number',
        },
        textLike: {
            paddingFactor: 'number',
            cornerRadius: 'number',
            colorPhaseStep: 'number',
            scale: 'number',
            rotationDeg: 'number',
            opacity: 'number',
            offsetX: 'number',
            offsetY: 'number',
        },
    };

    const colorParamMeta = {
        none: {
            loop: {
                label: 'Зациклить статичный цвет',
                hint: 'Если выключено — цвет не анимируется',
            },
        },
        rainbow: {
            windowFraction: {
                label: 'Ширина окна (доля трека)',
                hint: '0 — как раньше, >0 — окно, которое распределяется по буквам',
                min: 0,
                max: 1,
                step: 0.01,
            },
        },
        chase: {
            windowFraction: {
                label: 'Размер окна (доля текста)',
                hint: '0 — одна буква, больше — несколько букв одновременно',
                min: 0,
                max: 1,
                step: 0.01,
            },
            reverse: {
                label: 'Обратное направление',
            },
        },
    };

    const transformParamMeta = {
        slideLoop: {
            amplitudeXFactor: {
                label: 'Амплитуда по X (доля ширины)',
                hint: '0..1 от ширины кадра',
                min: 0,
                max: 1,
                step: 0.01,
            },
        },
        scalePulse: {
            minScale: {
                label: 'Мин. масштаб (%)',
                hint: 'Проценты, напр. 90',
                step: 1,
            },
            maxScale: {
                label: 'Макс. масштаб (%)',
                hint: 'Проценты, напр. 120',
                step: 1,
            },
        },
        shakeLoop: {
            steps: {
                label: 'Шаги',
                step: 1,
            },
            intensity: {
                label: 'Интенсивность (px)',
                step: 1,
            },
        },
        bounce: {
            heightAmplitudeFactor: {
                label: 'Высота отскока (доля высоты)',
                min: 0,
                max: 1,
                step: 0.01,
            },
            secondaryBounceFactor: {
                label: 'Второй отскок (множитель)',
                step: 0.1,
            },
        },
        vibrate: {
            steps: {
                label: 'Шаги',
                step: 1,
            },
            intensity: {
                label: 'Интенсивность (px)',
                step: 1,
            },
        },
    };

    const letterParamMeta = {
        vibrate: {
            intensity: { label: 'Интенсивность', step: 0.1, min: 0, max: 20 },
            steps: { label: 'Шаги', step: 1, min: 1, max: 120 },
        },
        typingFall: {
            delayPerLetterFactor: {
                label: 'Задержка на букву',
                hint: 'Доля длительности',
                step: 0.01,
                min: 0,
                max: 0.2,
            },
            fallDurationFactor: {
                label: 'Длительность падения',
                step: 0.01,
                min: 0,
                max: 1,
            },
            startYOffsetFactor: {
                label: 'Высота старта (доля высоты)',
                step: 0.1,
                min: -1,
                max: 1,
            },
        },
        wave: {
            amplitude: { label: 'Амплитуда (px)', step: 1, min: 0, max: 80 },
            steps: { label: 'Шаги', step: 1, min: 1, max: 160 },
            phasePerLetter: {
                label: 'Фаза на букву',
                step: 0.1,
                min: 0,
                max: 3,
            },
        },
        zigzag: {
            spread: { label: 'Размах (px)', step: 1, min: 0, max: 120 },
            steps: { label: 'Шаги', step: 1, min: 1, max: 160 },
            phasePerLetter: {
                label: 'Фаза на букву',
                step: 0.1,
                min: 0,
                max: 6.3,
            },
            baseScale: {
                label: 'Базовый масштаб (%)',
                step: 1,
                min: 50,
                max: 200,
            },
        },
        rotate: {
            fromAngle: {
                label: 'Угол от (градусы)',
                step: 1,
                min: -360,
                max: 360,
            },
            toAngle: {
                label: 'Угол до (градусы)',
                step: 1,
                min: -360,
                max: 360,
            },
            loop: {
                label: 'Зациклить вращение',
            },
        },
        snakeScale: {
            windowSize: {
                label: 'Длина хвоста (букв)',
                step: 1,
                min: 1,
                max: 50,
            },
            minScale: {
                label: 'Мин. масштаб (%)',
                step: 1,
                min: 10,
                max: 500,
            },
            maxScale: {
                label: 'Макс. масштаб (%)',
                step: 1,
                min: 10,
                max: 500,
            },
            steps: {
                label: 'Шаги',
                step: 1,
                min: 4,
                max: 200,
            },
            reverse: {
                label: 'Обратное направление',
            },
        },
    };

    const pathMorphParamMeta = {
        warp: {
            intensityFactor: {
                label: 'Интенсивность (коэфф.)',
                step: 0.01,
                min: 0,
                max: 0.5,
            },
            phases: {
                label: 'Фазы (массив)',
                hint: 'JSON: [0, 2π/3, 4π/3]',
            },
        },
        warpAiry: {
            intensityFactor: { label: 'Интенсивность', step: 0.01, min: 0, max: 0.5 },
            phases: {
                label: 'Фазы (массив)',
                hint: 'JSON: [0, 2π/3, 4π/3]',
            },
            lowFrequency: { label: 'Низкая частота', step: 0.01, min: 0, max: 1 },
            highFrequency: { label: 'Высокая частота', step: 0.01, min: 0, max: 1 },
            scaleFactor: { label: 'Масштаб', step: 0.01, min: 0, max: 0.5 },
            rotationFactor: { label: 'Вращение', step: 0.01, min: 0, max: 1 },
        },
        skewPulse: {
            intensityFactor: { label: 'Интенсивность', step: 0.01, min: 0, max: 0.5 },
            skewNormDivisor: { label: 'Делитель норм.', step: 0.1, min: 1, max: 20 },
            skewMin: { label: 'Минимальный скос', step: 0.01, min: 0, max: 1 },
            skewMax: { label: 'Максимальный скос', step: 0.01, min: 0, max: 1 },
            skewBase: { label: 'Базовый скос', step: 0.01, min: 0, max: 1 },
        },
        skewSwing: {
            intensityFactor: { label: 'Интенсивность', step: 0.01, min: 0, max: 0.5 },
            skewNormDivisor: { label: 'Делитель норм.', step: 0.1, min: 1, max: 20 },
            skewMin: { label: 'Минимальный скос', step: 0.01, min: 0, max: 1 },
            skewMax: { label: 'Максимальный скос', step: 0.01, min: 0, max: 1 },
            skewBase: { label: 'Базовый скос', step: 0.01, min: 0, max: 1 },
            swingAmplitudeScale: { label: 'Амплитуда раскачки', step: 0.01, min: 0, max: 1 },
        },
    };

    const letterWarnings = {
        vibrate: '⚠️ Vibrate потребляет много памяти. Используйте осторожно.',
    };

    const pathWarnings = {
        warp: '⚠️ Warp потребляет много памяти. Используйте внимательно.',
        warpAiry: '⚠️ WarpAiry потребляет много памяти. Используйте внимательно.',
    };

    function getTransformDefaults(type) {
        return (
            (state.meta &&
                state.meta.defaults &&
                state.meta.defaults.transformAnimationConfig &&
                state.meta.defaults.transformAnimationConfig[type]) ||
            null
        );
    }

    let autoPreviewTimeout = null;
    const AUTO_PREVIEW_DELAY = 600;

    function triggerAutoPreview() {
        if (!state.autoPreview) return;
        if (autoPreviewTimeout) {
            clearTimeout(autoPreviewTimeout);
            autoPreviewTimeout = null;
        }
        autoPreviewTimeout = window.setTimeout(() => {
            autoPreviewTimeout = null;
            previewCurrent();
        }, AUTO_PREVIEW_DELAY);
    }

    function attachAutoPreviewListeners() {
        const sections = document.querySelectorAll('.form-section');
        const handler = (event) => {
            const target = event.target;
            if (!state.autoPreview || !target) return;
            if (!(target.matches && target.matches('input, select, textarea'))) return;
            if (target.id === 'autoPreview') return;
            const nextValue = getAutoPreviewControlValue(target);
            const prevValue = target.dataset ? target.dataset.autoPreviewValue : undefined;
            if (prevValue !== undefined && prevValue === nextValue) return;
            if (target.dataset) {
                target.dataset.autoPreviewValue = nextValue;
            }
            triggerAutoPreview();
        };
        sections.forEach((section) => {
            const inputs = section.querySelectorAll('input, select, textarea');
            inputs.forEach((input) => {
                if (input.dataset) {
                    input.dataset.autoPreviewValue = getAutoPreviewControlValue(input);
                }
            });
            section.addEventListener('input', handler, true);
            section.addEventListener('change', handler, true);
        });
    }

    function getLetterDefaults(type) {
        return (
            (state.meta &&
                state.meta.defaults &&
                state.meta.defaults.letterAnimationConfig &&
                state.meta.defaults.letterAnimationConfig[type]) ||
            null
        );
    }

    function getPathMorphDefaults(type) {
        return (
            (state.meta &&
                state.meta.defaults &&
                state.meta.defaults.pathMorphAnimationConfig &&
                state.meta.defaults.pathMorphAnimationConfig[type]) ||
            null
        );
    }

    function getBackgroundParamMeta(type) {
        const meta =
            state.meta &&
            state.meta.defaults &&
            state.meta.defaults.backgroundParamMeta &&
            state.meta.defaults.backgroundParamMeta[type];
        return meta || {};
    }

    function getBackgroundDefaults(key) {
        return (
            (state.meta &&
                state.meta.defaults &&
                state.meta.defaults.backgroundDefaults &&
                state.meta.defaults.backgroundDefaults[key]) ||
            null
        );
    }

    function getBackgroundParamDefaults(type) {
        const defaults = getBackgroundDefaults(type);
        if (defaults && defaults.params) {
            return deepCopy(defaults.params);
        }
        return null;
    }

    function deepCopy(obj) {
        return obj == null ? obj : JSON.parse(JSON.stringify(obj));
    }

    function $(id) {
        return document.getElementById(id);
    }

    function setStatus(msg, isError) {
        const el = $('status');
        if (!el) return;
        el.textContent = msg || '';
        el.style.color = isError ? '#fecaca' : '#9ca3af';
    }

    function renderWarningMessage(targetId, message) {
        const el = $(targetId);
        if (!el) return;
        el.textContent = message || '';
    }

    function updateLetterWarning() {
        renderWarningMessage('letterWarning', letterWarnings[$('letterType').value] || '');
    }

    function updatePathWarning() {
        renderWarningMessage('pathWarning', pathWarnings[$('pathMorphType').value] || '');
    }

    async function api(path, options) {
        const normalizedPath = uiBaseUrl.pathname + path.replace(/^\.\//, '').replace(/^\/+/, '');
        const url = new URL(normalizedPath, uiBaseUrl);
        const res = await fetch(url.toString(), {
            headers: { 'Content-Type': 'application/json' },
            ...options,
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || res.statusText);
        }
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
            return res.json();
        }
        return res.text();
    }

    function getBaseColorFromDescriptor(desc) {
        if (!desc || typeof desc !== 'object') return undefined;
        const params = desc.params;
        if (!params) return undefined;
        if (Array.isArray(params.colors) && params.colors.length) {
            const [r, g, b] = params.colors[0];
            if ([r, g, b].every((v) => typeof v === 'number' && !Number.isNaN(v))) {
                return [r, g, b];
            }
        }
        const base = params.baseColor;
        if (!Array.isArray(base)) return undefined;
        const [r, g, b] = base;
        if ([r, g, b].some((v) => typeof v !== 'number' || Number.isNaN(v))) return undefined;
        return [r, g, b];
    }

    function getStrokeWidthFromDescriptor(desc) {
        if (!desc || typeof desc !== 'object') return undefined;
        const params = desc.params;
        if (!params) return undefined;
        const width = params.strokeWidth;
        return typeof width === 'number' && Number.isFinite(width) ? width : undefined;
    }

    function getFrameRateValue() {
        const select = $('frameRate');
        const val = parseInt((select && select.value) || '60', 10);
        return val === 30 ? 30 : 60;
    }

    function getDurationElements() {
        return { slider: $('durationSlider'), input: $('duration') };
    }

    function setDurationValue(value) {
        const { slider, input } = getDurationElements();
        if (!slider || !input) return;
        const fps = getFrameRateValue();
        const max = Math.max(fps * 3, MIN_DURATION_FRAMES);
        const numeric = Number.isFinite(value) ? value : parseInt(String(value || ''), 10) || MIN_DURATION_FRAMES;
        const clamped = Math.min(Math.max(MIN_DURATION_FRAMES, numeric), max);
        slider.min = String(MIN_DURATION_FRAMES);
        slider.max = String(max);
        slider.value = String(clamped);
        input.value = String(clamped);
        input.min = String(MIN_DURATION_FRAMES);
    }

    function updateDurationRange() {
        const { slider, input } = getDurationElements();
        if (!slider || !input) return;
        const fps = getFrameRateValue();
        const max = Math.max(fps * 3, MIN_DURATION_FRAMES);
        slider.min = String(MIN_DURATION_FRAMES);
        slider.max = String(max);
        input.min = String(MIN_DURATION_FRAMES);
        const current = parseInt(input.value || String(MIN_DURATION_FRAMES), 10) || MIN_DURATION_FRAMES;
        const clamped = Math.min(Math.max(MIN_DURATION_FRAMES, current), max);
        slider.value = String(clamped);
        input.value = String(clamped);
    }

    function normalizeColorParamsForUi(desc, fallbackColor, options = {}) {
        const params = desc && desc.params ? JSON.parse(JSON.stringify(desc.params)) : {};
        const baseColor =
            (Array.isArray(params.baseColor) ? params.baseColor : null) ||
            (Array.isArray(fallbackColor) ? fallbackColor : null);
        const isStatic =
            options.isStatic ||
            (desc && (desc.type === 'none' || desc.type === 'zebra'));

        if (!Array.isArray(params.colors) || !params.colors.length) {
            const base = baseColor || [1, 1, 1];
            const rgba = [
                Math.max(0, Math.min(1, base[0] ?? 1)),
                Math.max(0, Math.min(1, base[1] ?? 1)),
                Math.max(0, Math.min(1, base[2] ?? 1)),
                Math.max(0, Math.min(1, base[3] ?? 1)),
            ];
            params.colors = isStatic ? [rgba] : [rgba, rgba];
        } else {
            params.colors = params.colors.map((color) => {
                if (!Array.isArray(color)) return [1, 1, 1, 1];
                const [r = 1, g = 1, b = 1, a = 1] = color;
                return [
                    Math.max(0, Math.min(1, r)),
                    Math.max(0, Math.min(1, g)),
                    Math.max(0, Math.min(1, b)),
                    Math.max(0, Math.min(1, a)),
                ];
            });
        }

        if (!Array.isArray(params.times) || params.times.length !== params.colors.length) {
            const count = params.colors.length;
            params.times = Array.from({ length: count }, (_, idx) =>
                isStatic || count <= 1 ? 0 : idx / (count - 1),
            );
        }

        if (typeof params.loop !== 'boolean') {
            params.loop = !isStatic;
        }

        if (options.isStroke) {
            if (typeof params.strokeWidth !== 'number' || Number.isNaN(params.strokeWidth)) {
                if (typeof options.fallbackStrokeWidth === 'number') {
                    params.strokeWidth = options.fallbackStrokeWidth;
                }
            }
        } else {
            delete params.strokeWidth;
        }

        delete params.baseColor;
        return params;
    }

    function defaultFillColorParams() {
        return {
            colors: [[1, 1, 1, 1]],
            times: [0],
            loop: false,
        };
    }

    function defaultStrokeColorParams() {
        return {
            ...defaultFillColorParams(),
            strokeWidth: 2,
        };
    }

    const colorPresets = {
        none: [
            { id: 'static-white', label: 'Статичный • Белый', config: defaultFillColorParams() },
            {
                id: 'static-black',
                label: 'Статичный • Чёрный',
                config: {
                    colors: [[0, 0, 0, 1]],
                    times: [0],
                    loop: false,
                },
            },
            {
                id: 'static-soft',
                label: 'Статичный • Пастель',
                config: {
                    colors: [[1, 0.92, 0.84, 1]],
                    times: [0],
                    loop: false,
                },
            },
        ],
        cycleRGB: [
            {
                id: 'cycle-rgb',
                label: 'RGB',
                config: {
                    colors: [
                        [1, 0, 0, 1],
                        [0, 1, 0, 1],
                        [0, 0, 1, 1],
                        [1, 0, 0, 1],
                    ],
                    times: [0, 1 / 3, 2 / 3, 1],
                    loop: true,
                },
            },
            {
                id: 'cycle-sunset',
                label: 'Sunset',
                config: {
                    colors: [
                        [1, 0.71, 0.4, 1],
                        [1, 0.3, 0.5, 1],
                        [0.7, 0.3, 0.9, 1],
                        [1, 0.71, 0.4, 1],
                    ],
                    times: [0, 1 / 3, 2 / 3, 1],
                    loop: true,
                },
            },
            {
                id: 'cycle-aqua',
                label: 'Aqua',
                config: {
                    colors: [
                        [0, 0.8, 0.8, 1],
                        [0, 0.5, 0.9, 1],
                        [0.1, 0.9, 0.7, 1],
                        [0, 0.8, 0.8, 1],
                    ],
                    times: [0, 1 / 3, 2 / 3, 1],
                    loop: true,
                },
            },
            {
                id: 'cycle-neon',
                label: 'Neon',
                config: {
                    colors: [
                        [0.9, 1, 0, 1],
                        [0, 1, 0.8, 1],
                        [0.7, 0.3, 1, 1],
                        [0.9, 1, 0, 1],
                    ],
                    times: [0, 1 / 3, 2 / 3, 1],
                    loop: true,
                },
            },
        ],
        rainbow: [
            {
                id: 'rainbow-classic',
                label: 'Rainbow',
                config: {
                    colors: [
                        [1, 0, 0, 1],
                        [1, 0.5, 0, 1],
                        [1, 1, 0, 1],
                        [0, 1, 0, 1],
                        [0, 0.5, 1, 1],
                        [0, 0, 1, 1],
                        [0.5, 0, 1, 1],
                        [1, 0, 0.5, 1],
                        [1, 0, 0, 1],
                    ],
                    times: [0, 1 / 8, 2 / 8, 3 / 8, 4 / 8, 5 / 8, 6 / 8, 7 / 8, 1],
                    loop: true,
                },
            },
            {
                id: 'rainbow-soft',
                label: 'Soft Pastel',
                config: {
                    colors: [
                        [1, 0.8, 0.8, 1],
                        [1, 0.9, 0.7, 1],
                        [0.9, 1, 0.8, 1],
                        [0.7, 0.9, 1, 1],
                        [0.8, 0.7, 1, 1],
                        [1, 0.8, 0.8, 1],
                    ],
                    times: [0, 0.25, 0.5, 0.75, 0.95, 1],
                    loop: true,
                },
            },
        ],
    };

    const baseColorSwatches = [
        { label: 'Белый', rgba: [1, 1, 1, 1] },
        { label: 'Чёрный', rgba: [0, 0, 0, 1] },
        { label: 'Графит', rgba: [0.1, 0.12, 0.18, 1] },
        { label: 'Небо', rgba: [0.25, 0.65, 1, 1] },
        { label: 'Лайм', rgba: [0.52, 0.97, 0.5, 1] },
        { label: 'Неон', rgba: [1, 0.75, 0.3, 1] },
        { label: 'Персик', rgba: [1, 0.62, 0.55, 1] },
        { label: 'Фуксия', rgba: [0.88, 0.33, 0.77, 1] },
        { label: 'Лавандовый', rgba: [0.67, 0.54, 0.96, 1] },
        { label: 'Бирюза', rgba: [0.18, 0.82, 0.78, 1] },
    ];

    const LOCAL_PALETTE_STORAGE_KEY = 'stickerConfigurator.localPalette';

    function getColorPresets(type) {
        return colorPresets[type] || [];
    }

    function clonePresetConfig(preset, isStroke) {
        const cfg = JSON.parse(JSON.stringify(preset.config));
        if (isStroke) {
            cfg.strokeWidth = preset.strokeWidth ?? 2;
        }
        return cfg;
    }

    function getColorDefaults(type) {
        if (!type || !state.meta || !state.meta.defaults || !state.meta.defaults.colorAnimationConfig) {
            return null;
        }
        const cfg = state.meta.defaults.colorAnimationConfig[type];
        if (!cfg) return null;
        return JSON.parse(JSON.stringify(cfg));
    }

    function ensureLocalPaletteLoaded() {
        if (state.localPaletteLoaded) return;
        state.localPaletteLoaded = true;
        try {
            if (typeof window === 'undefined' || !window.localStorage) {
                state.localColorPalette = [];
                return;
            }
            const raw = window.localStorage.getItem(LOCAL_PALETTE_STORAGE_KEY);
            if (!raw) {
                state.localColorPalette = [];
                return;
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                state.localColorPalette = [];
                return;
            }
            state.localColorPalette = parsed
                .map((item) => normalizeRgba(item))
                .filter((color) => Array.isArray(color));
        } catch (err) {
            console.warn('Failed to load local palette', err);
            state.localColorPalette = [];
        }
    }

    function saveLocalPalette() {
        try {
            if (typeof window === 'undefined' || !window.localStorage) return;
            window.localStorage.setItem(
                LOCAL_PALETTE_STORAGE_KEY,
                JSON.stringify(state.localColorPalette || []),
            );
        } catch (err) {
            console.warn('Failed to save local palette', err);
        }
    }

    function getLocalPaletteColors() {
        ensureLocalPaletteLoaded();
        return (state.localColorPalette || []).map((color) => [...color]);
    }

    function addColorToLocalPalette(rgba) {
        const normalized = normalizeRgba(rgba);
        if (!normalized) return false;
        ensureLocalPaletteLoaded();
        const key = normalized.join(',');
        if ((state.localColorPalette || []).some((color) => color.join(',') === key)) {
            return false;
        }
        state.localColorPalette = [...(state.localColorPalette || []), normalized];
        saveLocalPalette();
        return true;
    }

    function removeColorFromLocalPalette(key) {
        ensureLocalPaletteLoaded();
        const palette = state.localColorPalette || [];
        const idx = palette.findIndex((color) => color.join(',') === key);
        if (idx === -1) return false;
        palette.splice(idx, 1);
        state.localColorPalette = [...palette];
        saveLocalPalette();
        return true;
    }

    function parseHexToNormalizedRgba(hex, alpha = 1) {
        if (!hex) return null;
        const clean = hex.replace('#', '').trim();
        if (clean.length !== 6 && clean.length !== 3) return null;
        const expand = clean.length === 3
            ? clean
                .split('')
                .map((ch) => ch + ch)
                .join('')
            : clean;
        const r = parseInt(expand.slice(0, 2), 16);
        const g = parseInt(expand.slice(2, 4), 16);
        const b = parseInt(expand.slice(4, 6), 16);
        if ([r, g, b].some((v) => Number.isNaN(v))) return null;
        return [r / 255, g / 255, b / 255, clamp01(alpha)];
    }

    function collectUsedColorsForPalette(currentValues, currentLabel) {
        const palette = new Map();
        const addColor = (rgba, source) => {
            const normalized = normalizeRgba(rgba);
            if (!normalized) return;
            const key = normalized
                .map((value) => Math.round(clamp01(value) * 1000) / 1000)
                .join(',');
            let entry = palette.get(key);
            if (!entry) {
                entry = {
                    key,
                    rgba: normalized,
                    hex: rgbaToHex(normalized),
                    alpha: normalized[3],
                    sources: new Set(),
                    count: 0,
                };
                palette.set(key, entry);
            }
            if (source) entry.sources.add(source);
            entry.count += 1;
        };

        const addFromDescriptors = (list, label) => {
            if (!Array.isArray(list)) return;
            list.forEach((desc) => {
                if (!desc || !desc.params || !Array.isArray(desc.params.colors)) return;
                desc.params.colors.forEach((rgba) => addColor(rgba, label));
            });
        };

        if (currentValues && Array.isArray(currentValues.colors)) {
            currentValues.colors.forEach((rgba) => addColor(rgba, currentLabel || 'Текущая анимация'));
        }

        const collectFromForm = (paramsId, selectId, label, opts = {}) => {
            const paramsEl = document.getElementById(paramsId);
            const selectEl = document.getElementById(selectId);
            if (!paramsEl || !selectEl || !selectEl.value) return;
            const params = readColorParams(paramsEl, selectEl.value, opts);
            if (params && Array.isArray(params.colors)) {
                params.colors.forEach((rgba) => addColor(rgba, label));
            }
        };

        collectFromForm('colorParams', 'colorType', 'Текст — заливка');
        collectFromForm('strokeParams', 'strokeType', 'Текст — обводка', { isStroke: true });

        (state.backgroundLayers || []).forEach((layer, idx) => {
            if (!layer) return;
            const baseLabel = `Фон ${idx + 1}`;
            addFromDescriptors(layer.colorAnimations, `${baseLabel} — заливка`);
            addFromDescriptors(layer.strokeAnimations, `${baseLabel} — обводка`);
        });

        if (state.knockout) {
            addFromDescriptors(state.knockout.colorAnimations, 'Knockout — заливка');
            addFromDescriptors(state.knockout.strokeAnimations, 'Knockout — обводка');
        }

        const sorted = Array.from(palette.values()).map((entry) => ({
            type: 'color',
            rgba: entry.rgba,
            hex: entry.hex,
            alpha: entry.alpha,
            label: entry.hex,
            tooltip:
                entry.sources.size > 0
                    ? `${entry.hex}\n${Array.from(entry.sources).join(', ')}`
                    : entry.hex,
            count: entry.count,
            key: entry.key,
            dedupeKey: `color:${entry.key}`,
        }));
        sorted.sort((a, b) => b.count - a.count);
        return sorted.slice(0, 20);
    }

    function createColorPaletteBlock({
        categories,
        onColorPick,
        onPresetPick,
        onRemoveLocal,
        onAddLocal,
        onAddLocalFromPicker,
    }) {
        if (
            !categories ||
            (
                !categories.some((cat) => cat.items && cat.items.length) &&
                !categories.some((cat) => cat.allowAdd)
            )
        ) {
            return null;
        }
        const block = document.createElement('div');
        block.className = 'color-palette';

        categories.forEach((category) => {
            const dedupe = new Set();
            const items = (category.items || []).reduce((acc, item) => {
                const baseKey =
                    item.dedupeKey ||
                    (item.type === 'preset'
                        ? `preset:${item.key || (item.preset && item.preset.id)}`
                        : `color:${item.key || (item.rgba && item.rgba.join(','))}`);
                if (!baseKey) return acc;
                if (dedupe.has(baseKey)) return acc;
                dedupe.add(baseKey);
                acc.push({ ...item, dedupeKey: baseKey });
                return acc;
            }, []);

            if (!items.length && !category.allowAdd) {
                return;
            }

            const section = document.createElement('div');
            section.className = 'color-swatch-section';
            const header = document.createElement('div');
            header.className = 'color-palette-header';
            const title = document.createElement('div');
            title.className = 'color-palette-title';
            title.textContent = category.title;
            header.appendChild(title);
            if (category.allowAdd && (onAddLocal || onAddLocalFromPicker)) {
                const actions = document.createElement('div');
                actions.className = 'color-palette-actions';
                if (onAddLocal) {
                    const addBtn = document.createElement('button');
                    addBtn.type = 'button';
                    addBtn.className = 'small-button';
                    addBtn.textContent = category.addButtonLabel || 'Добавить цвет';
                    addBtn.addEventListener('click', onAddLocal);
                    actions.appendChild(addBtn);
                }
                if (onAddLocalFromPicker) {
                    const pickerBtn = document.createElement('button');
                    pickerBtn.type = 'button';
                    pickerBtn.className = 'small-button secondary';
                    pickerBtn.textContent = category.addPickerButtonLabel || 'Выбрать цвет';
                    const hiddenInput = document.createElement('input');
                    hiddenInput.type = 'color';
                    hiddenInput.style.position = 'absolute';
                    hiddenInput.style.opacity = '0';
                    hiddenInput.style.pointerEvents = 'none';
                    hiddenInput.tabIndex = -1;
                    hiddenInput.addEventListener('change', () => {
                        if (!hiddenInput.value) return;
                        onAddLocalFromPicker(hiddenInput.value);
                    });
                    pickerBtn.addEventListener('click', (event) => {
                        event.preventDefault();
                        hiddenInput.click();
                    });
                    actions.appendChild(pickerBtn);
                    actions.appendChild(hiddenInput);
                }
                header.appendChild(actions);
            }
            section.appendChild(header);

            if (items.length) {
                const grid = document.createElement('div');
                grid.className = 'color-swatch-grid';
                items.forEach((item) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'color-swatch';
                    btn.title = item.tooltip || item.label || '';
                    const preview = document.createElement('span');
                    preview.className = 'color-swatch-preview';
                    if (item.type === 'preset' && item.gradient) {
                        preview.style.background = item.gradient;
                    } else {
                        preview.style.background = rgbaToCss(item.rgba);
                    }
                    const label = document.createElement('span');
                    label.className = 'color-swatch-label';
                    label.textContent = item.label || '';
                    btn.appendChild(preview);
                    btn.appendChild(label);

                    if (item.removable && onRemoveLocal) {
                        btn.classList.add('color-swatch-removable');
                        const removeBtn = document.createElement('span');
                        removeBtn.className = 'color-swatch-remove';
                        removeBtn.textContent = '✕';
                        removeBtn.title = 'Удалить из локальной палитры';
                        removeBtn.addEventListener('click', (event) => {
                            event.stopPropagation();
                            onRemoveLocal(item);
                        });
                        btn.appendChild(removeBtn);
                    }

                    btn.addEventListener('click', () => {
                        if (item.type === 'preset') {
                            if (onPresetPick) onPresetPick(item.preset);
                        } else if (onColorPick) {
                            onColorPick(item.rgba);
                        }
                    });
                    grid.appendChild(btn);
                });
                section.appendChild(grid);
            } else if (category.allowAdd) {
                const placeholder = document.createElement('div');
                placeholder.className = 'params-message';
                placeholder.textContent = 'Пока пусто';
                section.appendChild(placeholder);
            }

            block.appendChild(section);
        });

        return block;
    }

    function parseArrayInput(value) {
        if (!value) return undefined;
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            const parts = value.split(',').map(p => parseFloat(p.trim()));
            if (parts.some(n => Number.isNaN(n))) return undefined;
            return parts;
        }
        return undefined;
    }

    function clampNumber(val, min, max) {
        if (typeof val !== 'number' || Number.isNaN(val)) return min ?? 0;
        const lo = typeof min === 'number' ? min : -Infinity;
        const hi = typeof max === 'number' ? max : Infinity;
        return Math.min(hi, Math.max(lo, val));
    }

    function clamp01(val) {
        if (typeof val !== 'number' || Number.isNaN(val)) return 0;
        return Math.min(1, Math.max(0, val));
    }

    function normalizeRgba(color) {
        if (!Array.isArray(color) || color.length < 3) return null;
        const [r, g, b, a = 1] = color;
        if ([r, g, b].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
            return null;
        }
        return [clamp01(r), clamp01(g), clamp01(b), clamp01(a)];
    }

    function rgbaComponentToHex(value) {
        const v = clamp01(value);
        return Math.round(v * 255)
            .toString(16)
            .padStart(2, '0');
    }

    function rgbaToHex(rgba) {
        const color = normalizeRgba(rgba);
        if (!color) return '#000000';
        const [r, g, b] = color;
        return `#${rgbaComponentToHex(r)}${rgbaComponentToHex(g)}${rgbaComponentToHex(b)}`;
    }

    function rgbaToCss(rgba) {
        const color = normalizeRgba(rgba);
        if (!color) return 'rgba(0,0,0,1)';
        const [r, g, b, a = 1] = color;
        const to255 = (v) => Math.round(clamp01(v) * 255);
        return `rgba(${to255(r)}, ${to255(g)}, ${to255(b)}, ${clamp01(a).toFixed(2)})`;
    }

    function roundToPrecision(val, precision = 2) {
        if (typeof val !== 'number' || Number.isNaN(val)) return val;
        const safePrecision = Math.max(0, Math.min(10, precision));
        const factor = 10 ** safePrecision;
        return Math.round(val * factor) / factor;
    }

    function numbersAreClose(a, b, epsilon = 1e-4) {
        const aIsNum = typeof a === 'number' && Number.isFinite(a);
        const bIsNum = typeof b === 'number' && Number.isFinite(b);
        if (aIsNum && bIsNum) {
            return Math.abs(a - b) <= epsilon;
        }
        if (!aIsNum && !bIsNum) {
            return a === b;
        }
        return false;
    }

    function formatNumberValue(val, precision = 2) {
        if (typeof val !== 'number' || Number.isNaN(val)) return '';
        const rounded = roundToPrecision(val, precision);
        if (Number.isInteger(rounded)) return String(rounded);
        return rounded
            .toFixed(precision)
            .replace(/\.0+$/, '')
            .replace(/(\.\d*?)0+$/, '$1');
    }

    function dispatchParamEvents(input) {
        if (!input) return;
        try {
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            triggerAutoPreview();
        } catch {
            // ignore
        }
    }

    function didTextTransformChange(prev, next) {
        if (!prev) prev = {};
        if (!next) next = {};
        return ['scale', 'rotationDeg', 'offsetX', 'offsetY'].some(
            (key) => !numbersAreClose(prev[key], next[key]),
        );
    }

    function didBackgroundParamsChange(prev, next) {
        const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
        for (const key of keys) {
            const prevVal = prev ? prev[key] : undefined;
            const nextVal = next ? next[key] : undefined;
            if (typeof nextVal === 'number' || typeof prevVal === 'number') {
                if (!numbersAreClose(prevVal, nextVal)) return true;
            } else if (prevVal !== nextVal) {
                return true;
            }
        }
        return false;
    }

    function getAutoPreviewControlValue(el) {
        if (!el) return '';
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'input') {
            const type = (el.type || '').toLowerCase();
            if (type === 'checkbox' || type === 'radio') {
                return el.checked ? '1' : '0';
            }
            return el.value != null ? String(el.value) : '';
        }
        if (tag === 'select') {
            if (el.multiple) {
                return Array.from(el.options)
                    .filter((opt) => opt.selected)
                    .map((opt) => opt.value)
                    .join(',');
            }
            return el.value != null ? String(el.value) : '';
        }
        if (tag === 'textarea') {
            return el.value != null ? String(el.value) : '';
        }
        return el.value != null ? String(el.value) : '';
    }

    function createResetButton(onReset) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'param-reset-btn';
        btn.title = 'Сбросить значение по умолчанию';
        btn.textContent = '↺';
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            onReset();
        });
        return btn;
    }

    function getParamDefaultValue(type, key, defaults, metaCfg) {
        if (defaults && Object.prototype.hasOwnProperty.call(defaults, key)) {
            return deepCopy(defaults[key]);
        }
        if (metaCfg && Object.prototype.hasOwnProperty.call(metaCfg, 'default')) {
            return deepCopy(metaCfg.default);
        }
        if (type === 'boolean') return false;
        if (type === 'number') return 0;
        if (type === 'numberArray' || type === 'vec4Array') return [];
        return '';
    }

    function normalizeBackgroundParams(type, params) {
        const meta = getBackgroundParamMeta(type) || {};
        const normalized = { ...(params || {}) };
        Object.keys(meta).forEach((key) => {
            const cfg = meta[key];
            if (typeof normalized[key] === 'number') {
                normalized[key] = clampNumber(
                    normalized[key],
                    cfg.min ?? normalized[key],
                    cfg.max ?? normalized[key],
                );
            }
        });
        return normalized;
    }

    function makeDefaultBackgroundLayer(type) {
        const preset =
            (type === 'solid' && getBackgroundDefaults('solid')) ||
            (type === 'frame' && getBackgroundDefaults('frame')) ||
            (type === 'stripes' && getBackgroundDefaults('stripes')) ||
            (type === 'glyphPattern' && getBackgroundDefaults('glyphPattern')) ||
            (type === 'textLike' && getBackgroundDefaults('textLike'));
        if (preset) return deepCopy(preset);
        if (type === 'frame') {
            return {
                type,
                params: { paddingFactor: 0.05, cornerRadius: 8 },
                strokeAnimations: [
                    { type: 'none', params: { colors: [[1, 1, 1, 1]], times: [0], loop: false, strokeWidth: 2 } },
                ],
            };
        }
        if (type === 'stripes') {
            return {
                type,
                params: { count: 5, stripeHeightFactor: 0.1, gapFactor: 0.05, cornerRadius: 0 },
                colorAnimations: [
                    { type: 'none', params: { colors: [[0.2, 0.2, 0.2, 1]], times: [0], loop: false } },
                ],
            };
        }
        if (type === 'glyphPattern') {
            return {
                type,
                text: '*',
                params: {
                    paddingFactor: 0.1,
                    gridColumns: 2,
                    gridRows: 2,
                    spacingXFactor: 0.3,
                    spacingYFactor: 0.3,
                    colorPhaseStep: 0.1,
                },
                colorAnimations: [
                    { type: 'none', params: { colors: [[0.8, 0.8, 0.8, 1]], times: [0], loop: false } },
                ],
            };
        }
        if (type === 'textLike') {
            return {
                type,
                text: '',
                params: { paddingFactor: 0, colorPhaseStep: 0.1 },
                colorAnimations: [
                    { type: 'none', params: { colors: [[0.4, 0.4, 0.4, 0.3]], times: [0], loop: false } },
                ],
            };
        }
        return {
            type,
            params: { paddingFactor: 0, cornerRadius: 0 },
            colorAnimations: [
                { type: 'none', params: { colors: [[0.1, 0.1, 0.1, 1]], times: [0], loop: false } },
            ],
        };
    }

    function makeDefaultKnockout() {
        const preset = getBackgroundDefaults('knockout');
        if (preset) return deepCopy(preset);
        return {
            mode: 'fill',
            paddingFactor: 0.05,
            cornerRadiusFactor: 0,
            colorAnimations: [{ type: 'none', params: { colors: [[0, 0, 0, 0.8]], times: [0], loop: false } }],
            strokeAnimations: [
                { type: 'none', params: { colors: [[1, 1, 1, 1]], times: [0], loop: false, strokeWidth: 2 } },
            ],
        };
    }

    function ensureGlyphFontLoaded(fontFile) {
        if (!fontFile) return null;
        const familyName = 'glyphPreviewFont_' + fontFile.replace(/[^a-z0-9]+/gi, '_');
        const existing = document.getElementById('glyphPreviewFontStyle');
        if (existing && existing.dataset.fontFile === fontFile && existing.dataset.familyName === familyName) {
            return familyName;
        }
        if (existing) existing.remove();
        const style = document.createElement('style');
        style.id = 'glyphPreviewFontStyle';
        style.dataset.fontFile = fontFile;
        style.dataset.familyName = familyName;
        const lower = fontFile.toLowerCase ? fontFile.toLowerCase() : fontFile;
        const fontFormat = lower.endsWith('.otf') ? 'opentype' : 'truetype';
        style.textContent = `
@font-face {
    font-family: '${familyName}';
    src: url('./fonts/glyphs/${fontFile}') format('${fontFormat}'),
         url('./fonts/${fontFile}') format('${fontFormat}');
    font-display: swap;
}
`;
        document.head.appendChild(style);
        return familyName;
    }


    function ensureFontPreviewFace(fontFile) {
        if (!fontFile) return null;
        const familyName = 'fontPreviewFace_' + fontFile.replace(/[^a-z0-9]+/gi, '_');
        const existing = document.getElementById('fontPreviewStyle');
        if (existing && existing.dataset.fontFile === fontFile && existing.dataset.familyName === familyName) {
            return familyName;
        }
        if (existing) existing.remove();
        const style = document.createElement('style');
        style.id = 'fontPreviewStyle';
        style.dataset.fontFile = fontFile;
        style.dataset.familyName = familyName;
        const lower = fontFile.toLowerCase ? fontFile.toLowerCase() : fontFile;
        const fontFormat = lower.endsWith('.otf') ? 'opentype' : 'truetype';
        style.textContent = `
@font-face {
    font-family: '${familyName}';
    src: url('./fonts/${fontFile}') format('${fontFormat}');
    font-display: swap;
}
`;
        document.head.appendChild(style);
        return familyName;
    }

    function renderParams(container, schema, values, meta, defaults = undefined) {
        container.innerHTML = '';
        Object.entries(schema).forEach(([key, type]) => {
            const label = document.createElement('label');
            const metaCfg = meta && meta[key];
            if (metaCfg && metaCfg.hint) {
                label.title = metaCfg.hint;
            }
            const header = document.createElement('div');
            header.className = 'param-label-row';
            const title = document.createElement('span');
            title.textContent = metaCfg && metaCfg.label ? metaCfg.label : key;
            header.appendChild(title);
            label.appendChild(header);

            const defaultValue = getParamDefaultValue(type, key, defaults || {}, metaCfg);

            if (type === 'boolean') {
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.dataset.paramKey = key;
                const defaultChecked = typeof defaultValue === 'boolean' ? defaultValue : Boolean(defaultValue);
                input.checked =
                    values && typeof values[key] === 'boolean' ? Boolean(values[key]) : defaultChecked;
                label.appendChild(input);
                header.appendChild(
                    createResetButton(() => {
                        input.checked = defaultChecked;
                        dispatchParamEvents(input);
                    }),
                );
                container.appendChild(label);
                return;
            }

            if (type === 'number') {
                const wrapper = document.createElement('div');
                wrapper.className = 'slider-with-input';
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.dataset.paramKey = key;
                const numberInput = document.createElement('input');
                numberInput.type = 'number';
                numberInput.dataset.paramKey = key;
                const step = metaCfg && metaCfg.step != null ? metaCfg.step : 0.01;
                slider.step = String(step);
                numberInput.step = String(step);
                const defaultNumber =
                    typeof defaultValue === 'number'
                        ? defaultValue
                        : metaCfg && typeof metaCfg.default === 'number'
                            ? metaCfg.default
                            : 0;
                const currentValue =
                    values && typeof values[key] === 'number' ? values[key] : defaultNumber;
                const min =
                    metaCfg && metaCfg.min != null
                        ? metaCfg.min
                        : Math.min(0, Number(defaultNumber) || 0);
                const max =
                    metaCfg && metaCfg.max != null
                        ? metaCfg.max
                        : Math.max(Math.abs(Number(defaultNumber) || 0) * 2, 100);
                const sliderMax = max > min ? max : min + 1;
                slider.min = String(min);
                slider.max = String(sliderMax);
                const clampedValue = Math.min(Math.max(currentValue, min), sliderMax);
                slider.value = String(clampedValue);
                numberInput.value = String(
                    values && typeof values[key] === 'number' ? currentValue : clampedValue,
                );
                slider.addEventListener('input', () => {
                    numberInput.value = slider.value;
                });
                numberInput.addEventListener('input', () => {
                    const val = parseFloat(numberInput.value);
                    if (Number.isNaN(val)) return;
                    if (val < parseFloat(slider.min)) slider.min = String(val);
                    if (val > parseFloat(slider.max)) slider.max = String(val);
                    slider.value = String(val);
                });
                wrapper.appendChild(slider);
                wrapper.appendChild(numberInput);
                label.appendChild(wrapper);
                header.appendChild(
                    createResetButton(() => {
                        const clampedDefault = Math.min(Math.max(defaultNumber, min), sliderMax);
                        numberInput.value = String(defaultNumber);
                        slider.value = String(clampedDefault);
                        dispatchParamEvents(numberInput);
                    }),
                );
                container.appendChild(label);
                return;
            }

            const input = document.createElement('input');
            input.dataset.paramKey = key;
            input.type = 'text';
            const val = values ? values[key] : undefined;
            if ((type === 'numberArray' || type === 'vec4Array') && Array.isArray(val)) {
                input.value = JSON.stringify(val);
            } else if (val !== undefined) {
                input.value = String(val);
            }
            label.appendChild(input);
            header.appendChild(
                createResetButton(() => {
                    if (type === 'numberArray' || type === 'vec4Array') {
                        const arr = Array.isArray(defaultValue) ? defaultValue : [];
                        input.value = JSON.stringify(arr);
                    } else {
                        input.value = defaultValue != null ? String(defaultValue) : '';
                    }
                    dispatchParamEvents(input);
                }),
            );
            container.appendChild(label);
        });
    }

    function readParams(container, schema) {
        const params = {};
        const inputs = container.querySelectorAll('input[data-param-key]');
        inputs.forEach((input) => {
            const key = input.dataset.paramKey;
            const type = schema[key];
            if (type === 'boolean') {
                params[key] = input.checked;
            } else if (type === 'number') {
                const v = parseFloat(input.value);
                if (!Number.isNaN(v)) params[key] = v;
            } else if (type === 'numberArray' || type === 'vec4Array') {
                const arr = parseArrayInput(input.value);
                if (arr !== undefined) params[key] = arr;
            } else {
                if (input.value !== '') params[key] = input.value;
            }
        });
        return params;
    }

    function buildAnimationDescriptor(typeKey, schema, paramsContainer) {
        const type = typeKey;
        if (type === 'none') return undefined;
        const params = readParams(paramsContainer, schema[type] || {});
        return Object.keys(params).length ? { type, params } : { type };
    }

    function buildColorDescriptor(type, paramsContainer, options = {}) {
        if (!type) return undefined;
        const params = readColorParams(paramsContainer, type, { isStroke: options.isStroke });
        const merged = { ...params };

        if (!Array.isArray(merged.colors) || !merged.colors.length) {
            const fallback =
                options.baseColor ||
                options.fallbackBaseColor ||
                [1, 1, 1];
            const rgba = [...fallback.slice(0, 3), 1];
            merged.colors = type === 'none' ? [rgba] : [rgba, rgba];
        }

        if (!Array.isArray(merged.times) || merged.times.length !== merged.colors.length) {
            const count = merged.colors.length;
            merged.times = Array.from({ length: count }, (_, idx) =>
                count <= 1 ? 0 : idx / (count - 1),
            );
        }

        if (options.isStroke) {
            if (typeof merged.strokeWidth !== 'number' || Number.isNaN(merged.strokeWidth)) {
                const fallbackWidth =
                    options.strokeWidth ??
                    options.fallbackStrokeWidth ??
                    2;
                merged.strokeWidth = fallbackWidth;
            }
        } else {
            delete merged.strokeWidth;
        }

        return { type, params: merged };
    }

    function renderColorParams(container, type, values, options = {}) {
        container.innerHTML = '';
        if (!type) {
            const placeholder = document.createElement('div');
            placeholder.className = 'params-message';
            placeholder.textContent = 'Анимация отключена';
            container.appendChild(placeholder);
            return;
        }

        const schema = colorSchema[type] || {};
        if (!schema.colors || !schema.times) {
            renderParams(container, schema, values, colorParamMeta[type] || null);
            return;
        }

        const defaultValues = options.defaultValues || getColorDefaults(type) || null;

        const presets = getColorPresets(type);

        const paletteMount = document.createElement('div');
        paletteMount.className = 'color-palette-mount';
        container.appendChild(paletteMount);

        let sourceColors =
            (values && Array.isArray(values.colors) && values.colors.length
                ? values.colors
                : options.fallbackColors) || [];
        let sourceTimes =
            (values && Array.isArray(values.times) && values.times.length
                ? values.times
                : options.fallbackTimes) || [];
        const isStatic = type === 'none' || type === 'zebra';
        if (isStatic) {
            if (!sourceColors.length) sourceColors = [[1, 1, 1, 1]];
            sourceTimes = [0];
        }
        const loopDefault =
            (defaultValues && typeof defaultValues.loop === 'boolean'
                ? defaultValues.loop
                : undefined) ?? (options.fallbackLoop ?? !isStatic);
        const loop =
            values && typeof values.loop === 'boolean'
                ? values.loop
                : loopDefault;
        const strokeWidthDefault =
            options.isStroke
                ? (defaultValues && typeof defaultValues.strokeWidth === 'number'
                    ? defaultValues.strokeWidth
                    : options.fallbackStrokeWidth ?? 2)
                : undefined;
        const strokeWidthValue =
            options.isStroke &&
                values &&
                typeof values.strokeWidth === 'number' &&
                Number.isFinite(values.strokeWidth)
                ? values.strokeWidth
                : strokeWidthDefault;

        const rowsWrap = document.createElement('div');
        rowsWrap.className = 'color-rows';
        rowsWrap.dataset.type = type;

        let activeColorInput = null;
        let activeColorRow = null;
        const getActiveColorRgba = () => {
            if (!activeColorInput) return null;
            const hex = activeColorInput.value;
            const alpha = parseFloat(activeColorInput.dataset.alpha || '1');
            return parseHexToNormalizedRgba(hex, alpha);
        };

        let updatePalette = () => {};
        const setActiveColorRow = (row, input) => {
            if (activeColorRow && activeColorRow !== row) {
                activeColorRow.classList.remove('color-row-active');
            }
            activeColorRow = row;
            if (activeColorRow) {
                activeColorRow.classList.add('color-row-active');
            }
            if (input) {
                activeColorInput = input;
            }
        };

        const updateAlphaControls = (row, alpha) => {
            const alphaInput = row.querySelector('input[data-role="alpha"]');
            const alphaValueLabel = row.querySelector('.alpha-value');
            if (alphaInput) {
                const clamped = clamp01(typeof alpha === 'number' ? alpha : parseFloat(alphaInput.value) || 1);
                alphaInput.value = String(clamped);
                if (alphaValueLabel) {
                    alphaValueLabel.textContent = clamped.toFixed(2);
                }
                const colorInput = row.querySelector('input[data-role="color"]');
                if (colorInput) {
                    colorInput.dataset.alpha = String(clamped);
                }
            }
        };

        const applyPaletteColor = (rgba) => {
            const targetRow = activeColorRow || rowsWrap.querySelector('.color-row');
            if (!targetRow) return;
            const colorInputEl = targetRow.querySelector('input[data-role="color"]');
            if (!colorInputEl) return;
            setActiveColorRow(targetRow, colorInputEl);
            const normalized = normalizeRgba(rgba) || [0, 0, 0, 1];
            colorInputEl.value = rgbaToHex(normalized);
            colorInputEl.dataset.alpha = String(normalized[3] ?? 1);
            updateAlphaControls(targetRow, normalized[3]);
            dispatchParamEvents(colorInputEl);
            updatePalette();
        };

        const getCurrentValues = () => readColorParams(container, type, { isStroke: options.isStroke });

        updatePalette = () => {
            const currentValues = getCurrentValues();
            const usedColors = collectUsedColorsForPalette(
                currentValues,
                options && options.isStroke ? 'Текущая обводка' : 'Текущая заливка',
            );
            const presetItems = [];
            baseColorSwatches.forEach((swatch) => {
                presetItems.push({
                    type: 'color',
                    rgba: swatch.rgba,
                    label: swatch.label,
                    tooltip: swatch.label,
                    key: swatch.rgba.join(','),
                });
            });
            presets.forEach((preset) => {
                const colors = (preset.config && preset.config.colors) || [];
                let gradient = '#1f2937';
                if (colors.length > 1) {
                    gradient = `linear-gradient(90deg, ${colors.map((rgba) => rgbaToCss(rgba)).join(', ')})`;
                } else if (colors.length === 1) {
                    gradient = rgbaToCss(colors[0]);
                }
                presetItems.push({
                    type: 'preset',
                    label: preset.label,
                    tooltip: preset.label,
                    preset,
                    gradient,
                    key: preset.id,
                    dedupeKey: `preset:${preset.id}`,
                });
            });

            const localColors = getLocalPaletteColors().map((rgba) => ({
                type: 'color',
                rgba,
                label: rgbaToHex(rgba),
                tooltip: 'Локальная палитра',
                key: rgba.join(','),
                removable: true,
            }));

            const categories = [
                { title: 'Предустановленные цвета', items: presetItems },
                {
                    title: 'Локальная палитра',
                    items: localColors,
                    allowAdd: true,
                    addButtonLabel: 'Добавить текущий цвет',
                    addPickerButtonLabel: 'Выбрать цвет',
                },
                { title: 'Палитра варианта', items: usedColors },
            ];

            const block = createColorPaletteBlock({
                categories,
                onColorPick: (rgba) => applyPaletteColor(rgba),
                onPresetPick: (preset) => {
                    const presetCfg = clonePresetConfig(preset, options.isStroke);
                    renderColorParams(container, type, presetCfg, options);
                    setStatus('Пресет применён');
                },
                onRemoveLocal: (item) => {
                    const key = (item && item.key) || (item && item.rgba && item.rgba.join(','));
                    if (!key) return;
                    removeColorFromLocalPalette(key);
                    updatePalette();
                },
                onAddLocal: () => {
                    const current = getActiveColorRgba();
                    if (!current) {
                        setStatus('Выберите ключ цвета', true);
                        return;
                    }
                    const added = addColorToLocalPalette(current);
                    if (!added) {
                        setStatus('Цвет уже есть в локальной палитре');
                    } else {
                        setStatus('Цвет добавлен в локальную палитру');
                    }
                    updatePalette();
                },
                onAddLocalFromPicker: (hex) => {
                    const rgba = parseHexToNormalizedRgba(hex, 1);
                    if (!rgba) return;
                    const added = addColorToLocalPalette(rgba);
                    if (!added) {
                        setStatus('Цвет уже есть в локальной палитре');
                    } else {
                        setStatus('Цвет добавлен в локальную палитру');
                    }
                    applyPaletteColor(rgba);
                },
            });
            paletteMount.innerHTML = '';
            if (block) {
                paletteMount.appendChild(block);
            }
        };

        const count = Math.max(sourceColors.length, sourceTimes.length, 1);

        const makeRow = (idx, colorVal, timeVal) => {
            const row = document.createElement('div');
            row.className = 'color-row';
            row.dataset.index = String(idx);

            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.dataset.role = 'color';
            const rgba = Array.isArray(colorVal) ? colorVal : [1, 1, 1, 1];
            const [r, g, b, a] = rgba;
            const toHexComp = (v) => {
                const c = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
                return Math.round(c * 255)
                    .toString(16)
                    .padStart(2, '0');
            };
            const hex = `#${toHexComp(r)}${toHexComp(g)}${toHexComp(b)}`;
            colorInput.value = hex;
            colorInput.dataset.alpha = String(Number.isFinite(a) ? a : 1);

            const activateRow = (event) => {
                if (event) event.stopPropagation();
                setActiveColorRow(row, colorInput);
            };
            colorInput.addEventListener('focus', activateRow);
            colorInput.addEventListener('click', activateRow);
            const handleColorValueChange = () => {
                setActiveColorRow(row, colorInput);
                updatePalette();
            };
            colorInput.addEventListener('input', handleColorValueChange);
            colorInput.addEventListener('change', handleColorValueChange);
            row.addEventListener('click', (event) => {
                const target = event.target;
                if (target && target.closest('button')) return;
                setActiveColorRow(row, colorInput);
            });
            if (!activeColorRow) {
                setActiveColorRow(row, colorInput);
            }

            let timeInput;
            if (!isStatic) {
                const timeWrap = document.createElement('div');
                timeWrap.className = 'time-slider';
                const normalizedTime = Number.isFinite(timeVal) ? timeVal : idx / Math.max(count - 1, 1);
                const defaultTime = Math.max(0, Math.min(1, normalizedTime));
                timeInput = document.createElement('input');
                timeInput.type = 'range';
                timeInput.step = '0.01';
                timeInput.min = '0';
                timeInput.max = '1';
                timeInput.dataset.role = 'time';
                timeInput.value = String(defaultTime);
                const timeValueLabel = document.createElement('span');
                timeValueLabel.className = 'time-value';
                timeValueLabel.textContent = defaultTime.toFixed(2);
                timeInput.addEventListener('input', () => {
                    timeValueLabel.textContent = parseFloat(timeInput.value).toFixed(2);
                });
                const timeLabel = document.createElement('span');
                timeLabel.className = 'slider-label';
                timeLabel.textContent = 'Время';
                timeWrap.appendChild(timeLabel);
                timeWrap.appendChild(timeInput);
                timeWrap.appendChild(timeValueLabel);
                row.appendChild(timeWrap);
            }

            const alphaValue = Math.max(0, Math.min(1, Number.isFinite(a) ? a : 1));
            const alphaWrap = document.createElement('div');
            alphaWrap.className = 'alpha-slider';
            const alphaInput = document.createElement('input');
            alphaInput.type = 'range';
            alphaInput.step = '0.01';
            alphaInput.min = '0';
            alphaInput.max = '1';
            alphaInput.dataset.role = 'alpha';
            alphaInput.value = String(alphaValue);
            alphaInput.title = 'Прозрачность (0..1)';
            const alphaValueLabel = document.createElement('span');
            alphaValueLabel.className = 'alpha-value';
            alphaValueLabel.textContent = alphaValue.toFixed(2);
            alphaInput.addEventListener('input', () => {
                alphaValueLabel.textContent = parseFloat(alphaInput.value).toFixed(2);
                colorInput.dataset.alpha = alphaInput.value;
                updatePalette();
            });
            const alphaLabel = document.createElement('span');
            alphaLabel.className = 'slider-label';
            alphaLabel.textContent = 'Прозрачность';
            alphaWrap.appendChild(alphaLabel);
            alphaWrap.appendChild(alphaInput);
            alphaWrap.appendChild(alphaValueLabel);
            colorInput.dataset.alpha = String(alphaValue);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.textContent = '−';
            removeBtn.className = 'small-button';
            removeBtn.addEventListener('click', () => {
                row.remove();
                updatePalette();
            });

            row.appendChild(colorInput);
            row.appendChild(alphaWrap);
            if (count > 1 && type !== 'none') {
                row.appendChild(removeBtn);
            }
            rowsWrap.appendChild(row);
        };

        for (let i = 0; i < count; i += 1) {
            makeRow(i, sourceColors[i], sourceTimes[i]);
        }

        container.appendChild(rowsWrap);

        const buttonsWrap = document.createElement('div');
        buttonsWrap.style.display = 'flex';
        buttonsWrap.style.alignItems = 'center';
        buttonsWrap.style.gap = '6px';
        buttonsWrap.style.marginTop = '4px';

        if (type !== 'none') {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.textContent = 'Добавить ключ';
            addBtn.className = 'small-button';
            addBtn.addEventListener('click', () => {
                const currentRows = rowsWrap.querySelectorAll('.color-row');
                const idx = currentRows.length;
                makeRow(idx, [1, 1, 1, 1], idx === 0 ? 0 : 1);
                updatePalette();
            });
            buttonsWrap.appendChild(addBtn);
        }

        const loopLabel = document.createElement('label');
        loopLabel.style.display = 'flex';
        loopLabel.style.alignItems = 'center';
        loopLabel.style.gap = '4px';
        loopLabel.style.fontSize = '11px';
        const loopCheckbox = document.createElement('input');
        loopCheckbox.type = 'checkbox';
        loopCheckbox.checked = loop;
        loopCheckbox.dataset.role = 'loop';
        loopLabel.appendChild(loopCheckbox);
        const loopText = document.createElement('span');
        loopText.textContent = 'Зациклить';
        loopLabel.appendChild(loopText);
        loopLabel.appendChild(
            createResetButton(() => {
                loopCheckbox.checked = loopDefault;
                dispatchParamEvents(loopCheckbox);
            }),
        );

        buttonsWrap.appendChild(loopLabel);

        // windowFraction slider for rainbow
        if (type === 'rainbow') {
            const meta =
                (colorParamMeta.rainbow && colorParamMeta.rainbow.windowFraction) || null;
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.flexDirection = 'column';
            label.style.gap = '2px';
            label.style.fontSize = '11px';
            const header = document.createElement('div');
            header.className = 'param-label-row';
            const title = document.createElement('span');
            title.textContent = (meta && meta.label) || 'Ширина окна';
            if (meta && meta.hint) {
                label.title = meta.hint;
            }
            header.appendChild(title);
            label.appendChild(header);

            const wrapper = document.createElement('div');
            wrapper.className = 'slider-with-input';
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.step = String((meta && meta.step) || 0.01);
            const min = meta && typeof meta.min === 'number' ? meta.min : 0;
            const max = meta && typeof meta.max === 'number' ? meta.max : 1;
            slider.min = String(min);
            slider.max = String(max);
            const numberInput = document.createElement('input');
            numberInput.type = 'number';
            numberInput.step = slider.step;
            numberInput.min = slider.min;
            numberInput.max = slider.max;
            numberInput.dataset.role = 'window-fraction';

            const current =
                values && typeof values.windowFraction === 'number'
                    ? values.windowFraction
                    : '';
            const defaultVal = '';
            const applyValue = (v) => {
                if (v === '' || Number.isNaN(v)) {
                    slider.value = String(min);
                    numberInput.value = '';
                    return;
                }
                const clamped = Math.max(min, Math.min(max, v));
                slider.value = String(clamped);
                numberInput.value = String(clamped);
            };
            if (current !== '') {
                applyValue(current);
            } else {
                numberInput.value = '';
                slider.value = String(min);
            }

            slider.addEventListener('input', () => {
                const v = parseFloat(slider.value);
                if (Number.isNaN(v)) return;
                numberInput.value = slider.value;
            });
            numberInput.addEventListener('input', () => {
                const v = parseFloat(numberInput.value);
                if (Number.isNaN(v)) {
                    return;
                }
                if (v < parseFloat(slider.min)) slider.min = String(v);
                if (v > parseFloat(slider.max)) slider.max = String(v);
                slider.value = String(v);
            });

            wrapper.appendChild(slider);
            wrapper.appendChild(numberInput);
            label.appendChild(wrapper);

            header.appendChild(
                createResetButton(() => {
                    numberInput.value = defaultVal;
                    slider.value = String(min);
                    dispatchParamEvents(numberInput);
                }),
            );

            buttonsWrap.appendChild(label);
        }

        // windowFraction for chase
        if (type === 'chase') {
            const meta =
                (colorParamMeta.chase && colorParamMeta.chase.windowFraction) || null;
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.flexDirection = 'column';
            label.style.gap = '2px';
            label.style.fontSize = '11px';
            const header = document.createElement('div');
            header.className = 'param-label-row';
            const title = document.createElement('span');
            title.textContent = (meta && meta.label) || 'Размер окна (доля текста)';
            if (meta && meta.hint) {
                label.title = meta.hint;
            }
            header.appendChild(title);
            label.appendChild(header);

            const wrapper = document.createElement('div');
            wrapper.className = 'slider-with-input';
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.step = String((meta && meta.step) || 0.01);
            const minCh = meta && typeof meta.min === 'number' ? meta.min : 0;
            const maxCh = meta && typeof meta.max === 'number' ? meta.max : 1;
            slider.min = String(minCh);
            slider.max = String(maxCh);
            const numberInput = document.createElement('input');
            numberInput.type = 'number';
            numberInput.step = slider.step;
            numberInput.min = slider.min;
            numberInput.max = slider.max;
            numberInput.dataset.role = 'window-fraction';

            const currentCh =
                values && typeof values.windowFraction === 'number'
                    ? values.windowFraction
                    : '';
            const defaultValCh = '';
            const applyValueCh = (v) => {
                if (v === '' || Number.isNaN(v)) {
                    slider.value = String(minCh);
                    numberInput.value = '';
                    return;
                }
                const clamped = Math.max(minCh, Math.min(maxCh, v));
                slider.value = String(clamped);
                numberInput.value = String(clamped);
            };
            if (currentCh !== '') {
                applyValueCh(currentCh);
            } else {
                numberInput.value = '';
                slider.value = String(minCh);
            }

            slider.addEventListener('input', () => {
                const v = parseFloat(slider.value);
                if (Number.isNaN(v)) return;
                numberInput.value = slider.value;
            });
            numberInput.addEventListener('input', () => {
                const v = parseFloat(numberInput.value);
                if (Number.isNaN(v)) {
                    return;
                }
                if (v < parseFloat(slider.min)) slider.min = String(v);
                if (v > parseFloat(slider.max)) slider.max = String(v);
                slider.value = String(v);
            });

            wrapper.appendChild(slider);
            wrapper.appendChild(numberInput);
            label.appendChild(wrapper);

            header.appendChild(
                createResetButton(() => {
                    numberInput.value = defaultValCh;
                    slider.value = String(minCh);
                    dispatchParamEvents(numberInput);
                }),
            );

            buttonsWrap.appendChild(label);
        }

        container.appendChild(buttonsWrap);

        // Reverse direction for rainbow / chase
        if (type === 'rainbow' || type === 'chase') {
            const reverseLabel = document.createElement('label');
            reverseLabel.style.display = 'flex';
            reverseLabel.style.alignItems = 'center';
            reverseLabel.style.gap = '4px';
            reverseLabel.style.fontSize = '11px';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.role = 'reverse';

            const reverseDefault =
                defaultValues && typeof defaultValues.reverse === 'boolean' ? defaultValues.reverse : false;
            const reverseValue =
                values && typeof values.reverse === 'boolean' ? values.reverse : reverseDefault;
            checkbox.checked = reverseValue;

            const reverseText = document.createElement('span');
            reverseText.textContent = 'Обратное направление';

            reverseLabel.appendChild(checkbox);
            reverseLabel.appendChild(reverseText);
            reverseLabel.appendChild(
                createResetButton(() => {
                    checkbox.checked = reverseDefault;
                    dispatchParamEvents(checkbox);
                }),
            );
            container.appendChild(reverseLabel);
        }

        if (options.isStroke) {
            const strokeLabel = document.createElement('label');
            const header = document.createElement('div');
            header.className = 'param-label-row';
            const title = document.createElement('span');
            title.textContent = 'Толщина обводки (px)';
            header.appendChild(title);
            const strokeInput = document.createElement('input');
            strokeInput.type = 'number';
            strokeInput.step = '0.5';
            strokeInput.min = '0';
            strokeInput.dataset.role = 'stroke-width';
            if (typeof strokeWidthValue === 'number') {
                strokeInput.value = String(strokeWidthValue);
            }
            header.appendChild(
                createResetButton(() => {
                    if (typeof strokeWidthDefault === 'number') {
                        strokeInput.value = String(strokeWidthDefault);
                    } else {
                        strokeInput.value = '';
                    }
                    dispatchParamEvents(strokeInput);
                }),
            );
            strokeLabel.appendChild(header);
            strokeLabel.appendChild(strokeInput);
            container.appendChild(strokeLabel);
        }

        updatePalette();
    }

    function readColorParams(container, type, options = {}) {
        if (!type) {
            return {};
        }
        const schema = colorSchema[type] || {};
        if (!schema.colors || !schema.times) {
            return readParams(container, schema);
        }

        const rowsWrap = container.querySelector('.color-rows');
        if (!rowsWrap) {
            return {};
        }
        const rows = rowsWrap.querySelectorAll('.color-row');
        const colors = [];
        const times = [];
        rows.forEach((row) => {
            const colorInput = row.querySelector('input[data-role="color"]');
            const timeInput = row.querySelector('input[data-role="time"]');
            const alphaInput = row.querySelector('input[data-role="alpha"]');
            if (!colorInput || (!timeInput && type !== 'none' && type !== 'zebra')) return;
            const hex = colorInput.value || '#ffffff';
            const parseAlphaValue = (val) => {
                const num = parseFloat(val);
                if (Number.isNaN(num)) return undefined;
                return Math.max(0, Math.min(1, num));
            };
            const alpha =
                alphaInput && alphaInput.value !== ''
                    ? parseAlphaValue(alphaInput.value)
                    : parseAlphaValue(colorInput.dataset.alpha || '');
            const normalizedAlpha = alpha !== undefined ? alpha : 1;
            const parseHex = (h) => {
                const clean = h.replace('#', '');
                if (clean.length === 3) {
                    const r = parseInt(clean[0] + clean[0], 16);
                    const g = parseInt(clean[1] + clean[1], 16);
                    const b = parseInt(clean[2] + clean[2], 16);
                    return [r, g, b];
                }
                const r = parseInt(clean.slice(0, 2), 16);
                const g = parseInt(clean.slice(2, 4), 16);
                const b = parseInt(clean.slice(4, 6), 16);
                return [r, g, b];
            };
            const [r255, g255, b255] = parseHex(hex);
            const toNorm = (v) => Math.max(0, Math.min(1, v / 255));
            const time = timeInput ? parseFloat(timeInput.value) : 0;
            colors.push([toNorm(r255), toNorm(g255), toNorm(b255), normalizedAlpha]);
            if (!Number.isNaN(time)) {
                times.push(time);
            } else {
                times.push(0);
            }
        });

        const loopCheckbox = container.querySelector('input[data-role="loop"]');
        const loop = loopCheckbox ? loopCheckbox.checked : true;

        const result = {
            colors,
            times,
            loop,
        };

        if (type === 'rainbow' || type === 'chase') {
            const windowInput = container.querySelector(
                'input[type="number"][data-role="window-fraction"]',
            );
            if (windowInput) {
                const v = parseFloat(windowInput.value);
                if (Number.isFinite(v)) {
                    result.windowFraction = v;
                }
            }
        }

        if (options.isStroke) {
            const strokeInput = container.querySelector('input[data-role="stroke-width"]');
            if (strokeInput) {
                const width = parseFloat(strokeInput.value);
                if (!Number.isNaN(width)) {
                    result.strokeWidth = width;
                }
            }
        }

        const reverseInput = container.querySelector('input[data-role="reverse"]');
        if (reverseInput) {
            result.reverse = reverseInput.checked;
        }

        return result;
    }

    function getBackgroundTypeOptions() {
        if (
            state.meta &&
            state.meta.defaults &&
            Array.isArray(state.meta.defaults.backgroundLayerTypes)
        ) {
            return state.meta.defaults.backgroundLayerTypes;
        }
        return [
            { value: 'solid', label: 'Solid' },
            { value: 'frame', label: 'Frame' },
            { value: 'stripes', label: 'Stripes' },
            { value: 'glyphPattern', label: 'GlyphPattern' },
            { value: 'textLike', label: 'TextLike' },
        ];
    }

    function renderBackgroundLayers() {
        const list = $('backgroundLayersList');
        const addBtn = $('addBackgroundLayerBtn');
        if (!list) return;

        if (state.backgroundMode !== 'layers') {
            if (addBtn) addBtn.disabled = true;
            list.innerHTML = '';
            const info = document.createElement('div');
            info.className = 'params-message';
            info.textContent = 'Режим knockout активен — фоновые слои недоступны';
            list.appendChild(info);
            state.activeBackgroundIndex = null;
            renderBackgroundEditor(true);
            updateBackgroundOverlay();
            return;
        }

        if (addBtn) addBtn.disabled = false;
        list.innerHTML = '';
        if (!Array.isArray(state.backgroundLayers) || state.backgroundLayers.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'params-message';
            empty.textContent = 'Слои не добавлены';
            list.appendChild(empty);
            state.activeBackgroundIndex = null;
            renderBackgroundEditor();
            updateBackgroundOverlay();
            return;
        }

        let dragStartIndex = null;

        // Разрешаем drop на контейнере (для некоторых браузеров)
        list.ondragover = (e) => {
            e.preventDefault();
        };
        list.ondrop = (e) => {
            e.preventDefault();
        };

        state.backgroundLayers.forEach((layer, idx) => {
            const item = document.createElement('div');
            item.className = 'variant-item' + (state.activeBackgroundIndex === idx ? ' active' : '');
            item.draggable = true;
            item.dataset.index = String(idx);

            const title = document.createElement('div');
            title.className = 'variant-title';
            const label = document.createElement('span');
            label.textContent = layer.type || 'layer';
            title.appendChild(label);
            item.appendChild(title);

            const actions = document.createElement('div');
            actions.className = 'background-item-actions';

            const cloneBtn = document.createElement('button');
            cloneBtn.type = 'button';
            cloneBtn.textContent = '⧉';
            cloneBtn.title = 'Клонировать слой';
            cloneBtn.className = 'small-button';
            cloneBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const clone = deepCopy(layer);
                state.backgroundLayers.splice(idx + 1, 0, clone);
                state.activeBackgroundIndex = idx + 1;
                renderBackgroundLayers();
            });
            actions.appendChild(cloneBtn);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.textContent = '✕';
            removeBtn.title = 'Удалить слой';
            removeBtn.className = 'small-button';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                state.backgroundLayers.splice(idx, 1);
                if (state.activeBackgroundIndex === idx) {
                    state.activeBackgroundIndex = null;
                } else if ((state.activeBackgroundIndex || 0) > idx) {
                    state.activeBackgroundIndex -= 1;
                    if (state.activeBackgroundIndex < 0) state.activeBackgroundIndex = null;
                }
                renderBackgroundLayers();
            });
            actions.appendChild(removeBtn);

            item.appendChild(actions);

            item.addEventListener('click', () => {
                state.activeBackgroundIndex = idx;
                renderBackgroundLayers();
                renderBackgroundEditor();
            });

            item.addEventListener('dragstart', (e) => {
                dragStartIndex = idx;
                item.classList.add('dragging');
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(idx));
                }
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                dragStartIndex = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (dragStartIndex == null || dragStartIndex === idx) return;
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const from = dragStartIndex;
                if (from == null || from === idx) return;
                const to = idx;
                const layers = state.backgroundLayers;
                if (!Array.isArray(layers) || from < 0 || from >= layers.length || to < 0 || to >= layers.length) {
                    return;
                }
                const [moved] = layers.splice(from, 1);
                layers.splice(to, 0, moved);

                if (state.activeBackgroundIndex === from) {
                    state.activeBackgroundIndex = to;
                } else if (state.activeBackgroundIndex != null) {
                    let current = state.activeBackgroundIndex;
                    if (from < to) {
                        if (current > from && current <= to) current -= 1;
                    } else if (from > to) {
                        if (current >= to && current < from) current += 1;
                    }
                    state.activeBackgroundIndex = current;
                }

                renderBackgroundLayers();
            });

            list.appendChild(item);
        });
        if (state.activeBackgroundIndex == null || state.activeBackgroundIndex >= state.backgroundLayers.length) {
            state.activeBackgroundIndex = 0;
        }
        renderBackgroundEditor();
        updateBackgroundOverlay();
    }

    function renderBackgroundEditor(disabledMode = false) {
        const container = $('backgroundLayerEditor');
        if (!container) return;
        container.innerHTML = '';
        if (disabledMode) {
            const placeholder = document.createElement('div');
            placeholder.className = 'params-message';
            placeholder.textContent = 'Редактор слоёв выключен (knockout режим)';
            container.appendChild(placeholder);
            return;
        }
        const idx = state.activeBackgroundIndex;
        if (idx == null || !state.backgroundLayers[idx]) {
            const placeholder = document.createElement('div');
            placeholder.className = 'params-message';
            placeholder.textContent = 'Выберите слой для редактирования';
            container.appendChild(placeholder);
            return;
        }

        const layer = state.backgroundLayers[idx];
        const typeRow = document.createElement('div');
        typeRow.className = 'grid grid-3';
        const typeLabel = document.createElement('label');
        typeLabel.textContent = 'Тип слоя';
        const typeSelect = document.createElement('select');
        getBackgroundTypeOptions().forEach((opt) => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            typeSelect.appendChild(o);
        });
        typeSelect.value = layer.type || '';
        typeLabel.appendChild(typeSelect);
        typeRow.appendChild(typeLabel);
        container.appendChild(typeRow);

        const paramsContainer = document.createElement('div');
        paramsContainer.className = 'params';
        container.appendChild(paramsContainer);

        const fontRow = document.createElement('div');
        fontRow.className = 'grid grid-3';
        const fontLabel = document.createElement('label');
        fontLabel.textContent = 'fontFile (для паттернов)';
        const fontInput = document.createElement('select');
        const fontOptions = (state.meta && (state.meta.glyphFonts || state.meta.fonts)) || [];
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '—';
        fontInput.appendChild(emptyOpt);
        fontOptions.forEach((name) => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            fontInput.appendChild(opt);
        });
        fontInput.value = layer.fontFile || '';
        fontInput.disabled = layer.type !== 'glyphPattern' && layer.type !== 'textLike';
        fontLabel.appendChild(fontInput);

        const textLabel = document.createElement('label');
        textLabel.textContent = 'text (паттерн)';
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = layer.text || '';
        textInput.disabled = layer.type !== 'glyphPattern' && layer.type !== 'textLike';
        textLabel.appendChild(textInput);
        fontRow.appendChild(fontLabel);
        fontRow.appendChild(textLabel);
        container.appendChild(fontRow);

        const glyphPreviewWrapper = document.createElement('div');
        glyphPreviewWrapper.className = 'glyph-preview-container';
        const glyphPreview = document.createElement('div');
        glyphPreview.className = 'glyph-preview';
        glyphPreviewWrapper.appendChild(glyphPreview);
        container.appendChild(glyphPreviewWrapper);

        const params = normalizeBackgroundParams(layer.type, layer.params || {});
        const meta = state.meta && state.meta.defaults && state.meta.defaults.backgroundParamMeta
            ? state.meta.defaults.backgroundParamMeta[layer.type] || {}
            : {};
        const paramDefaults = getBackgroundParamDefaults(layer.type);
        renderParams(paramsContainer, backgroundParamSchema[layer.type] || {}, params, meta, paramDefaults);

        // Привязки инпутов font/text/params
        typeSelect.addEventListener('change', () => {
            layer.type = typeSelect.value;
            layer.params = normalizeBackgroundParams(layer.type, {});
            if (layer.type !== 'glyphPattern' && layer.type !== 'textLike') {
                layer.fontFile = undefined;
                layer.text = undefined;
            }
            renderBackgroundEditor();
            renderBackgroundLayers();
        });

        const renderGlyphPreview = (fontFile) => {
            glyphPreview.innerHTML = '';
            if (!fontFile) {
                glyphPreview.textContent = '—';
                return;
            }
            const glyphFontFamily = ensureGlyphFontLoaded(fontFile) || 'glyphPreviewFont_fallback';
            glyphPreview.textContent = 'Загрузка...';
            fetch(`./api/glyphs?font=${encodeURIComponent(fontFile)}`)
                .then((res) => res.json())
                .then((data) => {
                    glyphPreview.innerHTML = '';
                    if (!data || !Array.isArray(data.glyphs) || !data.glyphs.length) {
                        glyphPreview.textContent = 'Глифы не найдены';
                        return;
                    }
                    const table = document.createElement('table');
                    table.className = 'glyph-preview-table';
                    const thead = document.createElement('thead');
                    const headerRow = document.createElement('tr');
                    ['Glyph', 'Literal', 'Name', 'Cmds', 'Pts'].forEach((h) => {
                        const th = document.createElement('th');
                        th.textContent = h;
                        headerRow.appendChild(th);
                    });
                    thead.appendChild(headerRow);
                    table.appendChild(thead);

                    const tbody = document.createElement('tbody');
                    const toLiteral = (ch) => {
                        if (ch === ' ') return '` `';
                        return '`' + ch + '`';
                    };
                    data.glyphs.slice(0, 2000).forEach((g) => {
                        const tr = document.createElement('tr');

                        const tdChar = document.createElement('td');
                        tdChar.textContent = g.char;
                        tdChar.style.fontFamily = glyphFontFamily;
                        tdChar.className = 'glyph-char-cell';

                        const tdLiteral = document.createElement('td');
                        tdLiteral.textContent = toLiteral(g.char);
                        tdLiteral.className = 'glyph-literal-cell';
                        tdLiteral.title = 'Клик для копирования символа';

                        const tdName = document.createElement('td');
                        tdName.textContent = g.name || '';

                        const tdCmds = document.createElement('td');
                        tdCmds.textContent = g.commands && g.commands > 0 ? String(g.commands) : '';
                        const tdPts = document.createElement('td');
                        tdPts.textContent = g.points && g.points > 0 ? String(Math.round(g.points)) : '';

                        const copyValue = g.char;
                        tr.style.cursor = 'pointer';
                        tr.addEventListener('click', () => {
                            if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(copyValue).catch(() => { });
                            }
                        });

                        tr.appendChild(tdChar);
                        tr.appendChild(tdLiteral);
                        tr.appendChild(tdName);
                        tr.appendChild(tdCmds);
                        tr.appendChild(tdPts);
                        tbody.appendChild(tr);
                    });
                    table.appendChild(tbody);
                    glyphPreview.appendChild(table);
                })
                .catch(() => {
                    glyphPreview.textContent = 'Ошибка загрузки глифов';
                });
        };

        fontInput.addEventListener('change', () => {
            layer.fontFile = fontInput.value || undefined;
            if (layer.type === 'glyphPattern' || layer.type === 'textLike') {
                renderGlyphPreview(layer.fontFile);
            } else {
                glyphPreview.textContent = '—';
            }
        });

        textInput.addEventListener('input', () => {
            layer.text = textInput.value || undefined;
        });

        paramsContainer.oninput = () => {
            const normalized = normalizeBackgroundParams(
                layer.type,
                readParams(paramsContainer, backgroundParamSchema[layer.type] || {}),
            );
            layer.params = normalized;
        };

        const colorRow = document.createElement('div');
        colorRow.className = 'grid grid-3';
        const colorSelect = document.createElement('select');
        const colorParams = document.createElement('div');
        colorParams.className = 'params';
        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Fill';
        colorLabel.appendChild(colorSelect);
        colorRow.appendChild(colorLabel);
        colorRow.appendChild(colorParams);
        container.appendChild(colorRow);

        const strokeRow = document.createElement('div');
        strokeRow.className = 'grid grid-3';
        const strokeSelect = document.createElement('select');
        const strokeParams = document.createElement('div');
        strokeParams.className = 'params';
        const strokeLabel = document.createElement('label');
        strokeLabel.textContent = 'Stroke';
        strokeLabel.appendChild(strokeSelect);
        strokeRow.appendChild(strokeLabel);
        strokeRow.appendChild(strokeParams);
        container.appendChild(strokeRow);

        const pathRow = document.createElement('div');
        pathRow.className = 'grid grid-3';
        const pathSelect = document.createElement('select');
        const pathParams = document.createElement('div');
        pathParams.className = 'params';
        const pathLabel = document.createElement('label');
        pathLabel.textContent = 'PathMorph';
        pathLabel.appendChild(pathSelect);
        pathRow.appendChild(pathLabel);
        pathRow.appendChild(pathParams);
        container.appendChild(pathRow);

        const transformRow = document.createElement('div');
        transformRow.className = 'grid grid-3';
        const transformSelect = document.createElement('select');
        const transformParams = document.createElement('div');
        transformParams.className = 'params';
        const transformLabel = document.createElement('label');
        transformLabel.textContent = 'Transform';
        transformLabel.appendChild(transformSelect);
        transformRow.appendChild(transformLabel);
        transformRow.appendChild(transformParams);
        container.appendChild(transformRow);

        const letterRow = document.createElement('div');
        letterRow.className = 'grid grid-3';
        const letterSelect = document.createElement('select');
        const letterParams = document.createElement('div');
        letterParams.className = 'params';
        const letterLabel = document.createElement('label');
        letterLabel.textContent = 'Letter';
        letterLabel.appendChild(letterSelect);
        letterRow.appendChild(letterLabel);
        letterRow.appendChild(letterParams);
        container.appendChild(letterRow);

        function syncLayer() {
            const type = typeSelect.value || 'solid';
            layer.type = type;
            layer.params = normalizeBackgroundParams(type, readParams(paramsContainer, backgroundParamSchema[type] || {}));
            if (layer.type === 'glyphPattern' || layer.type === 'textLike') {
                layer.fontFile = fontInput.value || undefined;
                layer.text = textInput.value || undefined;
            } else {
                delete layer.fontFile;
                delete layer.text;
            }
            const transform = buildAnimationDescriptor(transformSelect.value, transformSchema, transformParams);
            layer.transformAnimations = transform ? [transform] : [];

            const letterDesc = buildAnimationDescriptor(letterSelect.value, letterSchema, letterParams);
            layer.letterAnimations = letterDesc ? [letterDesc] : [];

            const fillDesc = buildColorDescriptor(colorSelect.value, colorParams, {
                fallbackBaseColor: getBaseColorFromDescriptor(layer.colorAnimations && layer.colorAnimations[0]) || [0.1, 0.1, 0.1],
                isStatic: colorSelect.value === 'none',
            });
            layer.colorAnimations = fillDesc ? [fillDesc] : [];

            const strokeDesc = buildColorDescriptor(strokeSelect.value, strokeParams, {
                isStroke: true,
                fallbackBaseColor: getBaseColorFromDescriptor(layer.strokeAnimations && layer.strokeAnimations[0]) || [1, 1, 1],
                fallbackStrokeWidth: getStrokeWidthFromDescriptor(layer.strokeAnimations && layer.strokeAnimations[0]) || 2,
                isStatic: strokeSelect.value === 'none',
            });
            layer.strokeAnimations = strokeDesc ? [strokeDesc] : [];

            const pathDesc = buildAnimationDescriptor(pathSelect.value, pathMorphSchema, pathParams);
            layer.pathMorphAnimations = pathDesc ? [pathDesc] : [];
        }

        function renderAll() {
            renderParams(
                paramsContainer,
                backgroundParamSchema[typeSelect.value] || {},
                layer.params,
                getBackgroundParamMeta(typeSelect.value),
                getBackgroundParamDefaults(typeSelect.value),
            );
            fillSelect(transformSelect, [
                { value: 'none', label: 'None' },
                { value: 'slideLoop', label: 'SlideLoop' },
                { value: 'scalePulse', label: 'ScalePulse' },
                { value: 'shakeLoop', label: 'ShakeLoop' },
                { value: 'bounce', label: 'Bounce' },
                { value: 'vibrate', label: 'Vibrate' },
            ]);
            const transform = (layer.transformAnimations && layer.transformAnimations[0]) || null;
            transformSelect.value = (transform && transform.type) || 'none';
            renderParams(
                transformParams,
                transformSchema[transformSelect.value] || {},
                transform && transform.params,
                transformParamMeta[transformSelect.value] || null,
                getTransformDefaults(transformSelect.value),
            );

            fillSelect(letterSelect, [
                { value: 'none', label: 'None' },
                { value: 'vibrate', label: 'Vibrate' },
                { value: 'typingFall', label: 'TypingFall' },
                { value: 'wave', label: 'Wave' },
                { value: 'zigzag', label: 'ZigZag' },
                { value: 'rotate', label: 'Rotate' },
                { value: 'snakeScale', label: 'SnakeScale' },
            ]);
            const letter = (layer.letterAnimations && layer.letterAnimations[0]) || null;
            letterSelect.value = (letter && letter.type) || 'none';
            renderParams(
                letterParams,
                letterSchema[letterSelect.value] || {},
                letter && letter.params,
                letterParamMeta[letterSelect.value] || null,
                getLetterDefaults(letterSelect.value),
            );

            fillSelect(colorSelect, [
                { value: '', label: '—' },
                { value: 'none', label: 'None' },
                { value: 'zebra', label: 'Zebra' },
                { value: 'cycleRGB', label: 'CycleRGB' },
                { value: 'rainbow', label: 'Rainbow' },
            ]);
            const color = (layer.colorAnimations && layer.colorAnimations[0]) || null;
            colorSelect.value = (color && color.type) || '';
            renderColorParams(
                colorParams,
                colorSelect.value,
                normalizeColorParamsForUi(color, getBaseColorFromDescriptor(color) || [0.1, 0.1, 0.1], {
                    isStatic: colorSelect.value === 'none',
                }),
            );

            fillSelect(strokeSelect, [
                { value: '', label: '—' },
                { value: 'none', label: 'None' },
                { value: 'zebra', label: 'Zebra' },
                { value: 'cycleRGB', label: 'CycleRGB' },
                { value: 'rainbow', label: 'Rainbow' },
            ]);
            const stroke = (layer.strokeAnimations && layer.strokeAnimations[0]) || null;
            strokeSelect.value = (stroke && stroke.type) || '';
            renderColorParams(
                strokeParams,
                strokeSelect.value,
                normalizeColorParamsForUi(stroke, getBaseColorFromDescriptor(stroke) || [1, 1, 1], {
                    isStroke: true,
                    fallbackStrokeWidth: getStrokeWidthFromDescriptor(stroke) || 2,
                    isStatic: strokeSelect.value === 'none',
                }),
                { isStroke: true },
            );

            fillSelect(pathSelect, [
                { value: 'none', label: 'None' },
                { value: 'warp', label: 'Warp' },
                { value: 'warpAiry', label: 'WarpAiry' },
                { value: 'skewPulse', label: 'SkewPulse' },
                { value: 'skewSwing', label: 'SkewSwing' },
            ]);
            const pathMorph = (layer.pathMorphAnimations && layer.pathMorphAnimations[0]) || null;
            pathSelect.value = (pathMorph && pathMorph.type) || 'none';
            renderParams(
                pathParams,
                pathMorphSchema[pathSelect.value] || {},
                pathMorph && pathMorph.params,
                pathMorphParamMeta[pathSelect.value] || null,
                getPathMorphDefaults(pathSelect.value),
            );
            fontInput.disabled = layer.type !== 'glyphPattern' && layer.type !== 'textLike';
            textInput.disabled = fontInput.disabled;
        }

        typeSelect.addEventListener('change', () => {
            const newType = typeSelect.value || 'solid';
            const preset = makeDefaultBackgroundLayer(newType);
            state.backgroundLayers[idx] = { ...preset };
            state.activeBackgroundIndex = idx;
            renderBackgroundLayers();
            renderBackgroundEditor();
        });

        [fontInput, textInput].forEach((inp) => {
            inp.addEventListener('input', () => {
                syncLayer();
            });
        });
        const attachParamSync = (el, fn) => {
            if (el) {
                el.oninput = fn;
                el.onchange = fn;
            }
        };

        transformSelect.onchange = () => {
            renderParams(
                transformParams,
                transformSchema[transformSelect.value] || {},
                {},
                transformParamMeta[transformSelect.value] || null,
                getTransformDefaults(transformSelect.value),
            );
            syncLayer();
        };
        colorSelect.onchange = () => {
            renderColorParams(
                colorParams,
                colorSelect.value,
                getColorDefaults(colorSelect.value) || defaultFillColorParams(),
                {},
            );
            syncLayer();
        };
        strokeSelect.onchange = () => {
            const defaults = getColorDefaults(strokeSelect.value) || defaultStrokeColorParams();
            if (typeof defaults.strokeWidth !== 'number') defaults.strokeWidth = 2;
            renderColorParams(strokeParams, strokeSelect.value, defaults, { isStroke: true });
            syncLayer();
        };
        pathSelect.onchange = () => {
            renderParams(
                pathParams,
                pathMorphSchema[pathSelect.value] || {},
                {},
                pathMorphParamMeta[pathSelect.value] || null,
                getPathMorphDefaults(pathSelect.value),
            );
            syncLayer();
        };
        letterSelect.onchange = () => {
            renderParams(
                letterParams,
                letterSchema[letterSelect.value] || {},
                {},
                letterParamMeta[letterSelect.value] || null,
                getLetterDefaults(letterSelect.value),
            );
            syncLayer();
        };

        [transformParams, colorParams, strokeParams, pathParams, letterParams].forEach((el) =>
            attachParamSync(el, syncLayer),
        );

        transformParams.addEventListener('change', syncLayer);
        colorParams.addEventListener('change', syncLayer);
        strokeParams.addEventListener('change', syncLayer);
        pathParams.addEventListener('change', syncLayer);
        paramsContainer.addEventListener('change', syncLayer);

        renderAll();
        syncLayer();
        if (layer.type === 'glyphPattern' || layer.type === 'textLike') {
            renderGlyphPreview(layer.fontFile);
        } else {
            glyphPreview.textContent = '—';
        }
        updateBackgroundOverlay();
    }

    const backgroundDragState = {
        mode: null,
        layerIndex: null,
        startMouseX: 0,
        startMouseY: 0,
        startOffsetX: 0,
        startOffsetY: 0,
        startScale: 1,
        startRotationDeg: 0,
        startRadius: 0,
        startAngleRad: 0,
        scaleFactor: 1,
        viewportScale: 1,
        centerClientX: 0,
        centerClientY: 0,
        changed: false,
    };

    function getCompositionSize() {
        const defaults = state.meta && state.meta.defaults;
        const width = (defaults && typeof defaults.width === 'number' && defaults.width > 0) ? defaults.width : 512;
        const height =
            (defaults && typeof defaults.height === 'number' && defaults.height > 0) ? defaults.height : 512;
        return { width, height };
    }

    function ensurePreviewOverlay() {
        const content = $('previewContent') || $('previewContainer');
        if (!content) return null;
        let overlay = content.querySelector('.preview-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'preview-overlay';
            content.appendChild(overlay);
        }
        return overlay;
    }

    function renderStickerFrame(overlay) {
        if (!overlay) return;
        const { width: compWidth, height: compHeight } = getCompositionSize();
        const overlayRect = overlay.getBoundingClientRect();
        const ow = overlay.clientWidth || overlayRect.width;
        const oh = overlay.clientHeight || overlayRect.height;
        if (!ow || !oh || !compWidth || !compHeight) return;
        const scale = Math.min(ow / compWidth, oh / compHeight);
        const frameW = compWidth * scale;
        const frameH = compHeight * scale;
        const frame = document.createElement('div');
        frame.className = 'sticker-frame';
        frame.style.width = `${frameW}px`;
        frame.style.height = `${frameH}px`;
        frame.style.left = `${(ow - frameW) / 2}px`;
        frame.style.top = `${(oh - frameH) / 2}px`;
        overlay.appendChild(frame);
    }

    function computeTextVisual() {
        const container = $('previewContainer');
        if (!container) return null;
        const rect = container.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const { width: compWidth, height: compHeight } = getCompositionSize();
        const baseScale = Math.min(rect.width / (compWidth || 1), rect.height / (compHeight || 1)) || 1;
        const viewportScale = state.previewViewport?.scale || 1;
        const scaleFactor = baseScale;
        const params = state.textTransform || {};
        const layerScale =
            typeof params.scale === 'number' && Number.isFinite(params.scale) && params.scale > 0
                ? params.scale
                : 1;
        const rotationDeg =
            typeof params.rotationDeg === 'number' && Number.isFinite(params.rotationDeg) ? params.rotationDeg : 0;
        const offsetX =
            typeof params.offsetX === 'number' && Number.isFinite(params.offsetX) ? params.offsetX : 0;
        const offsetY =
            typeof params.offsetY === 'number' && Number.isFinite(params.offsetY) ? params.offsetY : 0;

        const visualWidth = compWidth * layerScale * scaleFactor;
        const visualHeight = compHeight * layerScale * scaleFactor;
        const centerX = rect.width / 2 + offsetX * scaleFactor;
        const centerY = rect.height / 2 + offsetY * scaleFactor;
        const centerClientX = rect.left + centerX * viewportScale;
        const centerClientY = rect.top + centerY * viewportScale;
        return {
            visualWidth,
            visualHeight,
            centerX,
            centerY,
            centerClientX,
            centerClientY,
            rotationDeg,
            scaleFactor: baseScale * viewportScale,
        };
    }

    const textDragState = {
        mode: null,
        startX: 0,
        startY: 0,
        startOffsetX: 0,
        startOffsetY: 0,
        startScale: 1,
        startRotation: 0,
        startRadius: 0,
        startAngle: 0,
        scaleFactor: 1,
        centerClientX: 0,
        centerClientY: 0,
        changed: false,
    };

    function setActiveOverlayTarget(target) {
        const value = target === 'background' ? 'background' : 'text';
        state.activeOverlayTarget = value;
        updateBackgroundOverlay();
        renderPreviewLayersList();
    }

    function syncTextInputsFromState() {
        const t = state.textTransform || {};
        if ($('textScale')) $('textScale').value = formatNumberValue(t.scale != null ? t.scale : 1);
        if ($('textRotation')) $('textRotation').value = formatNumberValue(t.rotationDeg != null ? t.rotationDeg : 0);
        if ($('textOffsetX')) $('textOffsetX').value = formatNumberValue(t.offsetX != null ? t.offsetX : 0);
        if ($('textOffsetY')) $('textOffsetY').value = formatNumberValue(t.offsetY != null ? t.offsetY : 0);
    }

    function updateTextTransformFromInputs() {
        const scale = parseFloat($('textScale').value) || 1;
        const rotation = parseFloat($('textRotation').value) || 0;
        const offsetX = parseFloat($('textOffsetX').value) || 0;
        const offsetY = parseFloat($('textOffsetY').value) || 0;
        state.textTransform = {
            scale,
            rotationDeg: rotation,
            offsetX,
            offsetY,
        };
        updateBackgroundOverlay();
        renderPreviewLayersList();
    }

    function initTextTransformResetButtons() {
        const configs = [
            { buttonId: 'textScaleReset', inputId: 'textScale', value: 1 },
            { buttonId: 'textRotationReset', inputId: 'textRotation', value: 0 },
            { buttonId: 'textOffsetXReset', inputId: 'textOffsetX', value: 0 },
            { buttonId: 'textOffsetYReset', inputId: 'textOffsetY', value: 0 },
        ];
        configs.forEach(({ buttonId, inputId, value }) => {
            const btn = document.getElementById(buttonId);
            const input = document.getElementById(inputId);
            if (!btn || !input) return;
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                input.value = formatNumberValue(value);
                updateTextTransformFromInputs();
            });
        });
    }

    function renderPreviewLayersList() {
        const container = $('previewLayersList');
        if (!container) return;
        container.innerHTML = '';

        const addItem = (label, isActive, onClick) => {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'preview-layer-item' + (isActive ? ' active' : '');
            el.textContent = label;
            el.addEventListener('click', onClick);
            container.appendChild(el);
        };

        addItem(
            'Текст',
            state.activeOverlayTarget === 'text',
            () => setActiveOverlayTarget('text'),
        );

        if (Array.isArray(state.backgroundLayers) && state.backgroundLayers.length) {
            state.backgroundLayers.forEach((layer, idx) => {
                const label =
                    (layer && layer.type ? `${idx + 1}: ${layer.type}` : `Фон ${idx + 1}`);
                const isActive =
                    state.activeOverlayTarget === 'background' &&
                    state.activeBackgroundIndex === idx;
                addItem(label, isActive, () => {
                    state.activeBackgroundIndex = idx;
                    setActiveOverlayTarget('background');
                    renderBackgroundLayers();
                    renderBackgroundEditor();
                });
            });
        }
    }

    function renderTextOverlay(overlay) {
        const visual = computeTextVisual();
        if (!overlay || !visual) return;
        const box = document.createElement('div');
        box.className = 'bg-layer-box text-box';
        box.style.width = `${visual.visualWidth}px`;
        box.style.height = `${visual.visualHeight}px`;
        box.style.left = `${visual.centerX - visual.visualWidth / 2}px`;
        box.style.top = `${visual.centerY - visual.visualHeight / 2}px`;
        // Поворачиваем рамку так же, как итоговый текст
        box.style.transform = `rotate(${visual.rotationDeg}deg)`;
        box.style.transformOrigin = '50% 50%';

        const label = document.createElement('div');
        label.className = 'bg-layer-label';
        label.textContent = 'Текст';
        box.appendChild(label);

        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'bg-layer-handle bg-layer-rotate-handle';
        rotateHandle.dataset.handle = 'rotate';
        box.appendChild(rotateHandle);

        const scaleHandle = document.createElement('div');
        scaleHandle.className = 'bg-layer-handle bg-layer-scale-handle';
        scaleHandle.dataset.handle = 'scale';
        box.appendChild(scaleHandle);

        // Перетаскивание по всему квадрату (кроме хэндлов)
        box.addEventListener('pointerdown', (e) => {
            const target = e.target;
            if (target && target.dataset && target.dataset.handle) return;
            setActiveOverlayTarget('text');
            startTextDrag(e, 'move', visual);
        });
        rotateHandle.addEventListener('pointerdown', (e) => {
            setActiveOverlayTarget('text');
            startTextDrag(e, 'rotate', visual);
        });
        scaleHandle.addEventListener('pointerdown', (e) => {
            setActiveOverlayTarget('text');
            startTextDrag(e, 'scale', visual);
        });

        overlay.appendChild(box);
    }

    function startTextDrag(event, mode, visual) {
        textDragState.mode = mode;
        textDragState.startX = event.clientX;
        textDragState.startY = event.clientY;
        textDragState.scaleFactor = visual.scaleFactor || 1;
        textDragState.centerClientX = visual.centerClientX;
        textDragState.centerClientY = visual.centerClientY;
        const params = state.textTransform || {};
        textDragState.startOffsetX = typeof params.offsetX === 'number' ? params.offsetX : 0;
        textDragState.startOffsetY = typeof params.offsetY === 'number' ? params.offsetY : 0;
        textDragState.startScale =
            typeof params.scale === 'number' && Number.isFinite(params.scale) && params.scale > 0
                ? params.scale
                : 1;
        textDragState.startRotation = typeof params.rotationDeg === 'number' ? params.rotationDeg : 0;
        if (mode === 'scale' || mode === 'rotate') {
            const dx = event.clientX - visual.centerClientX;
            const dy = event.clientY - visual.centerClientY;
            textDragState.startRadius = Math.sqrt(dx * dx + dy * dy) || 1;
            textDragState.startAngle = Math.atan2(dy, dx);
        } else {
            textDragState.startRadius = 0;
            textDragState.startAngle = 0;
        }
        textDragState.changed = false;
        try {
            event.preventDefault();
        } catch {}
    }

    function handleTextPointerMove(event) {
        if (!textDragState.mode) return;
        const prevParams = state.textTransform || {};
        const params = { ...prevParams };
        const scaleFactor = textDragState.scaleFactor || 1;
        if (textDragState.mode === 'move') {
            const dx = (event.clientX - textDragState.startX) / scaleFactor;
            const dy = (event.clientY - textDragState.startY) / scaleFactor;
            params.offsetX = roundToPrecision(textDragState.startOffsetX + dx);
            params.offsetY = roundToPrecision(textDragState.startOffsetY + dy);
        } else if (textDragState.mode === 'scale') {
            const dx = event.clientX - textDragState.centerClientX;
            const dy = event.clientY - textDragState.centerClientY;
            const r = Math.sqrt(dx * dx + dy * dy) || textDragState.startRadius || 1;
            const k = r / (textDragState.startRadius || 1);
            params.scale = clampNumber(textDragState.startScale * k, 0.1, 10);
            params.scale = roundToPrecision(params.scale);
        } else if (textDragState.mode === 'rotate') {
            const dx = event.clientX - textDragState.centerClientX;
            const dy = event.clientY - textDragState.centerClientY;
            const angle = Math.atan2(dy, dx);
            // положительный deltaDeg при движении по часовой стрелке
            const deltaDeg = (angle - textDragState.startAngle) * (180 / Math.PI);
            params.rotationDeg = roundToPrecision(textDragState.startRotation + deltaDeg);
        }
        const hasChanged = didTextTransformChange(prevParams, params);
        if (hasChanged) {
            state.textTransform = params;
            textDragState.changed = true;
            syncTextInputsFromState();
            updateBackgroundOverlay();
            renderPreviewLayersList();
        }
        try {
            event.preventDefault();
        } catch {}
    }

    function stopTextDrag() {
        const shouldTrigger = textDragState.changed;
        textDragState.mode = null;
        textDragState.changed = false;
        if (shouldTrigger) {
            triggerAutoPreview();
        }
    }

    function applyPreviewViewport() {
        const content = $('previewContent');
        if (!content) return;
        const vp = state.previewViewport || { scale: 1, offsetX: 0, offsetY: 0 };
        content.style.transform = `translate(${vp.offsetX}px, ${vp.offsetY}px) scale(${vp.scale})`;
        updateBackgroundOverlay();
        renderPreviewLayersList();
    }

    function updatePreviewControls() {
        const vp = state.previewViewport || { scale: 1, offsetX: 0, offsetY: 0 };
        const scaleInput = $('previewScale');
        const themeSelect = $('previewTheme');
        if (scaleInput) scaleInput.value = String(vp.scale);
        if (themeSelect) themeSelect.value = state.previewTheme || 'dark';
    }

    function computeBackgroundLayerVisual(layer) {
        if (!layer) return null;
        const container = $('previewContainer');
        const content = $('previewContent') || container;
        if (!container || !content) return null;
        const containerRect = container.getBoundingClientRect();
        if (!containerRect.width || !containerRect.height) return null;
        const contentRect = content.getBoundingClientRect();
        const viewportScale = state.previewViewport?.scale || 1;

        const { width: compWidth, height: compHeight } = getCompositionSize();
        const scaleFactor = Math.min(
            containerRect.width / (compWidth || 1),
            containerRect.height / (compHeight || 1),
        ) || 1;

        const params = normalizeBackgroundParams(layer.type, layer.params || {});

        let baseW = compWidth;
        let baseH = compHeight;
        if (layer.type === 'solid' || layer.type === 'frame') {
            const padding = Math.max(0, Math.min(0.5, params.paddingFactor ?? 0));
            baseW = compWidth * (1 + padding * 2);
            baseH = compHeight * (1 + padding * 2);
        } else if (layer.type === 'stripes') {
            const gapFactor = Math.max(0, Math.min(1, params.gapFactor ?? 0.05));
            baseW = compWidth;
            baseH = compHeight * (1 + gapFactor * 2);
        }

        const layerScale =
            typeof params.scale === 'number' && Number.isFinite(params.scale) && params.scale > 0
                ? params.scale
                : 1;
        const rotationDeg =
            typeof params.rotationDeg === 'number' && Number.isFinite(params.rotationDeg)
                ? params.rotationDeg
                : 0;
        const offsetX =
            typeof params.offsetX === 'number' && Number.isFinite(params.offsetX) ? params.offsetX : 0;
        const offsetY =
            typeof params.offsetY === 'number' && Number.isFinite(params.offsetY) ? params.offsetY : 0;

        const visualWidth = baseW * layerScale * scaleFactor;
        const visualHeight = baseH * layerScale * scaleFactor;
        const centerX = containerRect.width / 2 + offsetX * scaleFactor;
        const centerY = containerRect.height / 2 + offsetY * scaleFactor;
        const centerClientX = contentRect.left + contentRect.width / 2 + offsetX * scaleFactor * viewportScale;
        const centerClientY = contentRect.top + contentRect.height / 2 + offsetY * scaleFactor * viewportScale;

        return {
            containerRect,
            scaleFactor,
            baseWidth: baseW,
            baseHeight: baseH,
            visualWidth,
            visualHeight,
            centerX,
            centerY,
            centerClientX,
            centerClientY,
            rotationDeg,
            offsetX,
            offsetY,
            layerScale,
        };
    }

    function syncBackgroundParamInputsFromLayer(layer) {
        const editor = $('backgroundLayerEditor');
        if (!editor || !layer || !layer.params) return;
        const params = layer.params;
        Object.keys(params).forEach((key) => {
            if (typeof params[key] !== 'number') return;
            const value = params[key];
            const numInput = editor.querySelector(
                `input[type="number"][data-param-key="${key}"]`,
            );
            const rangeInput = editor.querySelector(
                `input[type="range"][data-param-key="${key}"]`,
            );
            const formattedValue = formatNumberValue(value);
            if (numInput) numInput.value = formattedValue;
            if (rangeInput) rangeInput.value = formattedValue;
        });
    }

    function updateBackgroundOverlay() {
        const overlay = ensurePreviewOverlay();
        if (!overlay) return;
        overlay.innerHTML = '';
        renderStickerFrame(overlay);
        if (state.activeOverlayTarget === 'text') {
            renderTextOverlay(overlay);
            return;
        }

        if (state.backgroundMode !== 'layers') {
            return;
        }
        const idx = state.activeBackgroundIndex;
        if (idx == null || !state.backgroundLayers || !state.backgroundLayers[idx]) {
            return;
        }
        const layer = state.backgroundLayers[idx];
        const visual = computeBackgroundLayerVisual(layer);
        if (!visual) return;

        const box = document.createElement('div');
        box.className = 'bg-layer-box';
        box.dataset.layerIndex = String(idx);

        const left = visual.centerX - visual.visualWidth / 2;
        const top = visual.centerY - visual.visualHeight / 2;
        box.style.width = `${visual.visualWidth}px`;
        box.style.height = `${visual.visualHeight}px`;
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
        box.style.transform = `rotate(${visual.rotationDeg}deg)`;
        box.style.transformOrigin = '50% 50%';

        const label = document.createElement('div');
        label.className = 'bg-layer-label';
        label.textContent = layer.type || 'layer';
        box.appendChild(label);

        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'bg-layer-handle bg-layer-rotate-handle';
        rotateHandle.dataset.handle = 'rotate';
        box.appendChild(rotateHandle);

        const scaleHandle = document.createElement('div');
        scaleHandle.className = 'bg-layer-handle bg-layer-scale-handle';
        scaleHandle.dataset.handle = 'scale';
        box.appendChild(scaleHandle);

        box.addEventListener('pointerdown', (e) => {
            const target = e.target;
            let mode = 'move';
            if (target && target.dataset && target.dataset.handle === 'rotate') {
                mode = 'rotate';
            } else if (target && target.dataset && target.dataset.handle === 'scale') {
                mode = 'scale';
            }
            setActiveOverlayTarget('background');
            startBackgroundDrag(e, mode, visual, idx);
        });

        overlay.appendChild(box);
    }

    function startBackgroundDrag(event, mode, visual, layerIndex) {
        if (state.backgroundMode !== 'layers') return;
        if (!state.backgroundLayers || !state.backgroundLayers[layerIndex]) return;
        const layer = state.backgroundLayers[layerIndex];
        const params = layer.params || {};

        backgroundDragState.mode = mode;
        backgroundDragState.layerIndex = layerIndex;
        backgroundDragState.startMouseX = event.clientX;
        backgroundDragState.startMouseY = event.clientY;
        backgroundDragState.scaleFactor = visual.scaleFactor || 1;
        backgroundDragState.centerClientX = visual.centerClientX;
        backgroundDragState.centerClientY = visual.centerClientY;

        const offsetX =
            typeof params.offsetX === 'number' && Number.isFinite(params.offsetX) ? params.offsetX : 0;
        const offsetY =
            typeof params.offsetY === 'number' && Number.isFinite(params.offsetY) ? params.offsetY : 0;
        const scale =
            typeof params.scale === 'number' && Number.isFinite(params.scale) && params.scale > 0
                ? params.scale
                : 1;
        const rotationDeg =
            typeof params.rotationDeg === 'number' && Number.isFinite(params.rotationDeg)
                ? params.rotationDeg
                : 0;

        backgroundDragState.startOffsetX = offsetX;
        backgroundDragState.startOffsetY = offsetY;
        backgroundDragState.startScale = scale;
        backgroundDragState.startRotationDeg = rotationDeg;
        backgroundDragState.viewportScale = 1;
        backgroundDragState.changed = false;

        if (mode === 'scale' || mode === 'rotate') {
            const dx0 = event.clientX - visual.centerClientX;
            const dy0 = event.clientY - visual.centerClientY;
            backgroundDragState.startRadius = Math.sqrt(dx0 * dx0 + dy0 * dy0) || 1;
            backgroundDragState.startAngleRad = Math.atan2(dy0, dx0);
        } else {
            backgroundDragState.startRadius = 0;
            backgroundDragState.startAngleRad = 0;
        }

        try {
            event.preventDefault();
        } catch {
            // ignore
        }
    }

    function handleBackgroundPointerMove(event) {
        if (!backgroundDragState.mode) return;
        if (backgroundDragState.layerIndex == null) return;
        if (!state.backgroundLayers || !state.backgroundLayers[backgroundDragState.layerIndex]) return;
        const layer = state.backgroundLayers[backgroundDragState.layerIndex];
        const prevParams = layer.params || {};
        const params = { ...prevParams };

        const mode = backgroundDragState.mode;
        const scaleFactor = backgroundDragState.scaleFactor || 1;

        if (mode === 'move') {
            const dxPx = event.clientX - backgroundDragState.startMouseX;
            const dyPx = event.clientY - backgroundDragState.startMouseY;
            const dx = dxPx / scaleFactor;
            const dy = dyPx / scaleFactor;
            params.offsetX = roundToPrecision(backgroundDragState.startOffsetX + dx);
            params.offsetY = roundToPrecision(backgroundDragState.startOffsetY + dy);
        } else if (mode === 'scale') {
            const cx = backgroundDragState.centerClientX;
            const cy = backgroundDragState.centerClientY;
            const dx = event.clientX - cx;
            const dy = event.clientY - cy;
            const r = Math.sqrt(dx * dx + dy * dy) || backgroundDragState.startRadius || 1;
            const k = r / (backgroundDragState.startRadius || 1);
            let nextScale = backgroundDragState.startScale * (Number.isFinite(k) ? k : 1);
            nextScale = clampNumber(nextScale, 0.1, 10);
            params.scale = roundToPrecision(nextScale);
        } else if (mode === 'rotate') {
            const cx = backgroundDragState.centerClientX;
            const cy = backgroundDragState.centerClientY;
            const dx = event.clientX - cx;
            const dy = event.clientY - cy;
            const angle = Math.atan2(dy, dx);
            const deltaRad = angle - backgroundDragState.startAngleRad;
            const deltaDeg = (deltaRad * 180) / Math.PI;
            params.rotationDeg = roundToPrecision(backgroundDragState.startRotationDeg + deltaDeg);
        }

        const prevNormalized = normalizeBackgroundParams(layer.type, prevParams);
        const normalized = normalizeBackgroundParams(layer.type, params);
        if (didBackgroundParamsChange(prevNormalized, normalized)) {
            layer.params = normalized;
            backgroundDragState.changed = true;
            syncBackgroundParamInputsFromLayer(layer);
            updateBackgroundOverlay();
        }

        try {
            event.preventDefault();
        } catch {
            // ignore
        }
    }

    function stopBackgroundDrag() {
        backgroundDragState.mode = null;
        backgroundDragState.layerIndex = null;
        const shouldTrigger = backgroundDragState.changed;
        backgroundDragState.changed = false;
        if (shouldTrigger) {
            triggerAutoPreview();
        }
    }

    function initBackgroundOverlay() {
        ensurePreviewOverlay();
        window.addEventListener('pointermove', handleBackgroundPointerMove);
        window.addEventListener('pointerup', stopBackgroundDrag);
        window.addEventListener('pointercancel', stopBackgroundDrag);
        window.addEventListener('pointermove', handleTextPointerMove);
        window.addEventListener('pointerup', stopTextDrag);
        window.addEventListener('pointercancel', stopTextDrag);
    }

    function initPreviewViewportControls() {
        const scaleInput = $('previewScale');
        const resetBtn = $('previewResetView');
        const dragHandle = $('previewDragHandle');
        const themeSelect = $('previewTheme');

        const clampScale = (v) => Math.min(3, Math.max(0.3, v));

        if (scaleInput) {
            scaleInput.addEventListener('input', () => {
                const val = clampScale(parseFloat(scaleInput.value) || 1);
                state.previewViewport.scale = val;
                applyPreviewViewport();
                updateBackgroundOverlay();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                state.previewViewport.scale = 1;
                state.previewViewport.offsetX = 0;
                state.previewViewport.offsetY = 0;
                updatePreviewControls();
                applyPreviewViewport();
            });
        }

        if (dragHandle) {
            const onPointerDown = (e) => {
                state.previewViewport.dragging = true;
                state.previewViewport.startX = e.clientX;
                state.previewViewport.startY = e.clientY;
                state.previewViewport.startOffsetX = state.previewViewport.offsetX;
                state.previewViewport.startOffsetY = state.previewViewport.offsetY;
                if (dragHandle.setPointerCapture) {
                    dragHandle.setPointerCapture(e.pointerId);
                }
            };
            const onPointerMove = (e) => {
                if (!state.previewViewport.dragging) return;
                const dx = e.clientX - state.previewViewport.startX;
                const dy = e.clientY - state.previewViewport.startY;
                state.previewViewport.offsetX = state.previewViewport.startOffsetX + dx;
                state.previewViewport.offsetY = state.previewViewport.startOffsetY + dy;
                updatePreviewControls();
                applyPreviewViewport();
            };
            const stop = (e) => {
                if (state.previewViewport.dragging && e && e.pointerId != null) {
                    if (dragHandle.releasePointerCapture) {
                        try {
                            dragHandle.releasePointerCapture(e.pointerId);
                        } catch {
                            // ignore
                        }
                    }
                }
                state.previewViewport.dragging = false;
            };
            dragHandle.addEventListener('pointerdown', onPointerDown);
            dragHandle.addEventListener('pointermove', onPointerMove);
            dragHandle.addEventListener('pointerup', stop);
            dragHandle.addEventListener('pointercancel', stop);
            dragHandle.addEventListener('lostpointercapture', stop);
        }

        if (themeSelect) {
            const applyTheme = () => {
                const val = themeSelect.value || 'dark';
                state.previewTheme = val;
                const container = $('previewContainer');
                if (container) {
                    container.classList.remove('theme-dark', 'theme-light', 'theme-checker');
                    container.classList.add(`theme-${val}`);
                }
            };
            themeSelect.addEventListener('change', applyTheme);
            applyTheme();
        }

        updatePreviewControls();
        applyPreviewViewport();
    }

    function updateFontFilePreview() {
        const fontSelect = $('fontFile');
        const sample = $('fontFilePreviewSample');
        const textInput = $('previewText');
        if (!fontSelect || !sample) return;
        const fontFile =
            fontSelect.value || (state.meta && state.meta.defaults && state.meta.defaults.fontFile) || '';
        const previewFontFamily =
            ensureFontPreviewFace(fontFile) || 'fontPreviewFace_fallback';
        const text = (textInput && textInput.value) || 'Abc АБВ 123 ✦☆';
        sample.textContent = text;
        sample.style.fontFamily = previewFontFamily;
    }

    function renderKnockoutControls() {
        const modeSelect = $('knockoutMode');
        const paddingInput = $('knockoutPadding');
        const cornerInput = $('knockoutCornerRadius');
        const scaleInput = $('knockoutScale');
        const rotationInput = $('knockoutRotation');
        const opacityInput = $('knockoutOpacity');
        const offsetXInput = $('knockoutOffsetX');
        const offsetYInput = $('knockoutOffsetY');
        const transformSelect = $('knockoutTransformType');
        const transformParams = $('knockoutTransformParams');
        const fillSelectEl = $('knockoutFillType');
        const fillParams = $('knockoutFillParams');
        const strokeSelectEl = $('knockoutStrokeType');
        const strokeParams = $('knockoutStrokeParams');
        const pathSelectEl = $('knockoutPathMorphType');
        const pathParams = $('knockoutPathMorphParams');
        const letterSelectEl = $('knockoutLetterType');
        const letterParams = $('knockoutLetterParams');

        if (!state.knockout) state.knockout = makeDefaultKnockout();

        const isKnockoutMode = state.backgroundMode === 'knockout';
        if (modeSelect) modeSelect.disabled = !isKnockoutMode;
        [paddingInput, cornerInput, scaleInput, rotationInput, opacityInput, offsetXInput, offsetYInput].forEach((el) => {
            if (el) el.disabled = !isKnockoutMode;
        });
        [transformSelect, fillSelectEl, strokeSelectEl, pathSelectEl, letterSelectEl].forEach((el) => {
            if (el) el.disabled = !isKnockoutMode;
        });

        const knockoutModes =
            (state.meta &&
                state.meta.defaults &&
                Array.isArray(state.meta.defaults.knockoutModes) &&
                state.meta.defaults.knockoutModes) ||
            [
                { value: 'fill', label: 'fill' },
                { value: 'stroke', label: 'stroke' },
            ];
        fillSelect(modeSelect, knockoutModes);
        modeSelect.value = state.knockout.mode || 'fill';

        paddingInput.value =
            typeof state.knockout.paddingFactor === 'number' ? state.knockout.paddingFactor : 0.05;
        cornerInput.value =
            typeof state.knockout.cornerRadiusFactor === 'number'
                ? state.knockout.cornerRadiusFactor
                : 0;
        scaleInput.value =
            typeof state.knockout.scale === 'number' ? state.knockout.scale : 1;
        rotationInput.value =
            typeof state.knockout.rotationDeg === 'number' ? state.knockout.rotationDeg : 0;
        opacityInput.value =
            typeof state.knockout.opacity === 'number' ? state.knockout.opacity : 1;
        offsetXInput.value =
            typeof state.knockout.offsetX === 'number' ? state.knockout.offsetX : 0;
        offsetYInput.value =
            typeof state.knockout.offsetY === 'number' ? state.knockout.offsetY : 0;

        fillSelect(transformSelect, [
            { value: 'none', label: 'None' },
            { value: 'slideLoop', label: 'SlideLoop' },
            { value: 'scalePulse', label: 'ScalePulse' },
            { value: 'shakeLoop', label: 'ShakeLoop' },
            { value: 'bounce', label: 'Bounce' },
            { value: 'vibrate', label: 'Vibrate' },
        ]);
        const koTransform = (state.knockout.transformAnimations && state.knockout.transformAnimations[0]) || null;
        transformSelect.value = (koTransform && koTransform.type) || 'none';
        renderParams(
            transformParams,
            transformSchema[transformSelect.value] || {},
            koTransform && koTransform.params,
            transformParamMeta[transformSelect.value] || null,
            getTransformDefaults(transformSelect.value),
        );

        fillSelect(fillSelectEl, [
            { value: '', label: '—' },
            { value: 'none', label: 'None' },
            { value: 'zebra', label: 'Zebra' },
            { value: 'cycleRGB', label: 'CycleRGB' },
            { value: 'rainbow', label: 'Rainbow' },
        ]);
        const fillDesc = (state.knockout.colorAnimations && state.knockout.colorAnimations[0]) || null;
        fillSelectEl.value = (fillDesc && fillDesc.type) || '';
        renderColorParams(
            fillParams,
            fillSelectEl.value,
            normalizeColorParamsForUi(fillDesc, getBaseColorFromDescriptor(fillDesc) || [0, 0, 0], {
                isStatic: fillSelectEl.value === 'none',
            }),
        );

        fillSelect(strokeSelectEl, [
            { value: '', label: '—' },
            { value: 'none', label: 'None' },
            { value: 'zebra', label: 'Zebra' },
            { value: 'cycleRGB', label: 'CycleRGB' },
            { value: 'rainbow', label: 'Rainbow' },
        ]);
        const strokeDesc = (state.knockout.strokeAnimations && state.knockout.strokeAnimations[0]) || null;
        strokeSelectEl.value = (strokeDesc && strokeDesc.type) || '';
        renderColorParams(
            strokeParams,
            strokeSelectEl.value,
            normalizeColorParamsForUi(
                strokeDesc,
                getBaseColorFromDescriptor(strokeDesc) || [1, 1, 1],
                {
                    isStroke: true,
                    fallbackStrokeWidth: getStrokeWidthFromDescriptor(strokeDesc) || 2,
                    isStatic: strokeSelectEl.value === 'none',
                },
            ),
            { isStroke: true },
        );

        fillSelect(pathSelectEl, [
            { value: 'none', label: 'None' },
            { value: 'warp', label: 'Warp' },
            { value: 'warpAiry', label: 'WarpAiry' },
            { value: 'skewPulse', label: 'SkewPulse' },
            { value: 'skewSwing', label: 'SkewSwing' },
        ]);
        const pathDesc = (state.knockout.pathMorphAnimations && state.knockout.pathMorphAnimations[0]) || null;
        pathSelectEl.value = (pathDesc && pathDesc.type) || 'none';
        renderParams(
            pathParams,
            pathMorphSchema[pathSelectEl.value] || {},
            pathDesc && pathDesc.params,
            pathMorphParamMeta[pathSelectEl.value] || null,
            getPathMorphDefaults(pathSelectEl.value),
        );

        const sync = () => {
            if (!isKnockoutMode) {
                return;
            }
            const ko = state.knockout || makeDefaultKnockout();
            ko.mode = modeSelect.value || 'fill';
            ko.paddingFactor = clampNumber(parseFloat(paddingInput.value), 0, 0.5);
            ko.cornerRadiusFactor = clampNumber(parseFloat(cornerInput.value), 0, 1);
            const scaleVal = parseFloat(scaleInput.value);
            ko.scale = Number.isFinite(scaleVal) ? clampNumber(scaleVal, 0, 5) : 1;
            ko.rotationDeg = clampNumber(parseFloat(rotationInput.value), -360, 360);
            const opacityVal = parseFloat(opacityInput.value);
            ko.opacity = Number.isFinite(opacityVal) ? clampNumber(opacityVal, 0, 1) : 1;
            ko.offsetX = clampNumber(parseFloat(offsetXInput.value), -1000, 1000);
            ko.offsetY = clampNumber(parseFloat(offsetYInput.value), -1000, 1000);
            const tr = buildAnimationDescriptor(transformSelect.value, transformSchema, transformParams);
            ko.transformAnimations = tr ? [tr] : [];
            const fill = buildColorDescriptor(fillSelectEl.value, fillParams, {
                isStatic: fillSelectEl.value === 'none',
            });
            ko.colorAnimations = fill ? [fill] : [];
            const stroke = buildColorDescriptor(strokeSelectEl.value, strokeParams, {
                isStroke: true,
                fallbackStrokeWidth: getStrokeWidthFromDescriptor(strokeDesc) || 2,
                isStatic: strokeSelectEl.value === 'none',
            });
            ko.strokeAnimations = stroke ? [stroke] : [];
            const path = buildAnimationDescriptor(pathSelectEl.value, pathMorphSchema, pathParams);
            ko.pathMorphAnimations = path ? [path] : [];
            const letterDesc = buildAnimationDescriptor(letterSelectEl.value, letterSchema, letterParams);
            ko.letterAnimations = letterDesc ? [letterDesc] : [];
            state.knockout = ko;
        };

        modeSelect.onchange = sync;
        paddingInput.oninput = sync;
        cornerInput.oninput = sync;
        scaleInput.oninput = sync;
        rotationInput.oninput = sync;
        opacityInput.oninput = sync;
        offsetXInput.oninput = sync;
        offsetYInput.oninput = sync;
        transformSelect.onchange = () => {
            renderParams(
                transformParams,
                transformSchema[transformSelect.value] || {},
                {},
                transformParamMeta[transformSelect.value] || null,
                getTransformDefaults(transformSelect.value),
            );
            sync();
        };
        fillSelectEl.onchange = () => {
            renderColorParams(
                fillParams,
                fillSelectEl.value,
                getColorDefaults(fillSelectEl.value) || defaultFillColorParams(),
            );
            sync();
        };
        strokeSelectEl.onchange = () => {
            const defaults = getColorDefaults(strokeSelectEl.value) || defaultStrokeColorParams();
            if (typeof defaults.strokeWidth !== 'number') defaults.strokeWidth = 2;
            renderColorParams(strokeParams, strokeSelectEl.value, defaults, { isStroke: true });
            sync();
        };
        pathSelectEl.onchange = () => {
            renderParams(
                pathParams,
                pathMorphSchema[pathSelectEl.value] || {},
                {},
                pathMorphParamMeta[pathSelectEl.value] || null,
                getPathMorphDefaults(pathSelectEl.value),
            );
            sync();
        };
        fillSelect(letterSelectEl, [
            { value: 'none', label: 'None' },
            { value: 'vibrate', label: 'Vibrate' },
            { value: 'typingFall', label: 'TypingFall' },
            { value: 'wave', label: 'Wave' },
            { value: 'zigzag', label: 'ZigZag' },
            { value: 'rotate', label: 'Rotate' },
            { value: 'snakeScale', label: 'SnakeScale' },
        ]);
        const koLetter = (state.knockout.letterAnimations && state.knockout.letterAnimations[0]) || null;
        letterSelectEl.value = (koLetter && koLetter.type) || 'none';
        renderParams(
            letterParams,
            letterSchema[letterSelectEl.value] || {},
            koLetter && koLetter.params,
            letterParamMeta[letterSelectEl.value] || null,
            getLetterDefaults(letterSelectEl.value),
        );
        letterSelectEl.onchange = () => {
            renderParams(
                letterParams,
                letterSchema[letterSelectEl.value] || {},
                {},
                letterParamMeta[letterSelectEl.value] || null,
                getLetterDefaults(letterSelectEl.value),
            );
            sync();
        };
        transformParams.onchange = sync;
        fillParams.onchange = sync;
        strokeParams.onchange = sync;
        pathParams.onchange = sync;
        letterParams.onchange = sync;

        sync();
    }

    function setBackgroundMode(mode) {
        state.backgroundMode = mode === 'knockout' ? 'knockout' : 'layers';
        if (state.backgroundMode === 'knockout') {
            state.backgroundLayers = [];
            state.activeBackgroundIndex = null;
            resetTextAnimationsForKnockout();
        } else {
            // keep knockout object but ignore it in serialization
        }
        renderBackgroundLayers();
        renderKnockoutControls();
        renderPreviewLayersList();
        updateBackgroundVisibility();
        renderPreviewLayersList();
    }

    function resetTextAnimationsForKnockout() {
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };
        setValue('transformType', 'none');
        setValue('colorType', '');
        setValue('strokeType', '');
        setValue('letterType', 'none');
        setValue('pathMorphType', 'none');
        renderParams(
            $('transformParams'),
            transformSchema['none'] || {},
            {},
            transformParamMeta['none'] || null,
            getTransformDefaults('none'),
        );
        renderColorParams($('colorParams'), '', {});
        renderColorParams($('strokeParams'), '', {}, { isStroke: true });
        renderParams(
            $('letterParams'),
            letterSchema['none'] || {},
            {},
            letterParamMeta['none'] || null,
            getLetterDefaults('none'),
        );
        renderParams(
            $('pathMorphParams'),
            pathMorphSchema['none'] || {},
            {},
            pathMorphParamMeta['none'] || null,
            getPathMorphDefaults('none'),
        );
        updateLetterWarning();
        updatePathWarning();
    }

    function updateBackgroundVisibility() {
        const layersSection = document.getElementById('backgroundLayersSection');
        const knockoutSection = document.getElementById('knockoutSection');
        const textAnimationsSection = document.getElementById('textAnimationsSection');
        const bgModeSection = document.getElementById('backgroundModeSection');
        if (layersSection) {
            layersSection.style.display = state.backgroundMode === 'layers' ? '' : 'none';
        }
        if (knockoutSection) {
            knockoutSection.style.display = state.backgroundMode === 'knockout' ? '' : 'none';
        }
        if (textAnimationsSection) {
            textAnimationsSection.style.display = state.backgroundMode === 'knockout' ? 'none' : '';
        }
        if (bgModeSection) {
            bgModeSection.style.display = '';
        }
        updateTextAnimationsAvailability();
    }

    function updateTextAnimationsAvailability() {
        const disabled = state.backgroundMode === 'knockout';
        const idsToToggle = [
            'transformType',
            'colorType',
            'strokeType',
            'letterType',
            'pathMorphType',
        ];
        idsToToggle.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.disabled = disabled;
        });
        const paramContainers = [
            'transformParams',
            'colorParams',
            'strokeParams',
            'letterParams',
            'pathMorphParams',
        ];
        paramContainers.forEach((id) => {
            const container = document.getElementById(id);
            if (!container) return;
            const inputs = container.querySelectorAll('input, select, textarea, button');
            inputs.forEach((el) => {
                el.disabled = disabled;
            });
            container.style.opacity = disabled ? '0.5' : '';
        });
    }
    function fillSelect(select, options) {
        select.innerHTML = '';
        options.forEach((opt) => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        });
    }

    function ensureOption(select, value, label) {
        if (!select || !value) return;
        const exists = Array.from(select.options).some((opt) => opt.value === value);
        if (exists) return;
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label || value;
        opt.disabled = true;
        select.appendChild(opt);
    }

    function getCurrentConfig() {
        const frameRate = parseInt($('frameRate').value || '60', 10) || 60;
        const duration = Math.max(MIN_DURATION_FRAMES, parseInt($('duration').value || '0', 10) || MIN_DURATION_FRAMES);
        const fontFile = $('fontFile').value || undefined;
        const textTransform = {
            scale: parseFloat($('textScale').value) || 1,
            rotationDeg: parseFloat($('textRotation').value) || 0,
            offsetX: parseFloat($('textOffsetX').value) || 0,
            offsetY: parseFloat($('textOffsetY').value) || 0,
        };
        state.textTransform = { ...textTransform };

        const transformType = $('transformType').value;
        const colorType = $('colorType').value;
        const strokeType = $('strokeType').value;
        const letterType = $('letterType').value;
        const pathMorphType = $('pathMorphType').value;

        const active = state.activeId
            ? state.variants.find((v) => v.id === state.activeId)
            : null;
        const baseCfg = active && active.config ? active.config : {};

        const transform = buildAnimationDescriptor(transformType, transformSchema, $('transformParams'));

        const existingColors = Array.isArray(baseCfg.colorAnimations) ? baseCfg.colorAnimations.slice() : [];
        const currentColorDesc = existingColors[0];
        const color = buildColorDescriptor(colorType, $('colorParams'), {
            fallbackBaseColor: getBaseColorFromDescriptor(currentColorDesc) || baseCfg.fillColor || [1, 1, 1],
            isStatic: colorType === 'none',
        });

        const existingStrokes = Array.isArray(baseCfg.strokeAnimations) ? baseCfg.strokeAnimations.slice() : [];
        const currentStrokeDesc = existingStrokes[0];
        const fallbackStrokeWidth = getStrokeWidthFromDescriptor(currentStrokeDesc) ?? baseCfg.strokeWidth ?? 2;
        const stroke = buildColorDescriptor(strokeType, $('strokeParams'), {
            isStroke: true,
            fallbackBaseColor: getBaseColorFromDescriptor(currentStrokeDesc) || baseCfg.strokeColor || [1, 1, 1],
            fallbackStrokeWidth,
            isStatic: strokeType === 'none',
        });

        const letter = buildAnimationDescriptor(letterType, letterSchema, $('letterParams'));
        const pathMorph = buildAnimationDescriptor(pathMorphType, pathMorphSchema, $('pathMorphParams'));

        const cfg = { ...baseCfg };
        delete cfg.width;
        delete cfg.height;
        delete cfg.fontSize;
        if (frameRate !== undefined) cfg.frameRate = frameRate;
        if (duration !== undefined) cfg.duration = duration;
        if (fontFile) cfg.fontFile = fontFile;
        delete cfg.fillColor;
        delete cfg.strokeColor;
        delete cfg.strokeWidth;

        const existingTransforms = Array.isArray(baseCfg.transformAnimations)
            ? baseCfg.transformAnimations.slice()
            : [];
        const restTransforms = existingTransforms.slice(1);
        const transforms = transform ? [transform, ...restTransforms] : restTransforms;
        if (transforms.length) cfg.transformAnimations = transforms;
        else delete cfg.transformAnimations;

        const restColors = existingColors.slice(1);
        const colors = color ? [color, ...restColors] : restColors;
        if (colors.length) cfg.colorAnimations = colors;
        else delete cfg.colorAnimations;

        const restStrokes = existingStrokes.slice(1);
        const strokes = stroke ? [stroke, ...restStrokes] : restStrokes;
        if (strokes.length) cfg.strokeAnimations = strokes;
        else delete cfg.strokeAnimations;

        const existingLetters = Array.isArray(baseCfg.letterAnimations)
            ? baseCfg.letterAnimations.slice()
            : [];
        const restLetters = existingLetters.slice(1);
        const letters = letter ? [letter, ...restLetters] : restLetters;
        if (letters.length) cfg.letterAnimations = letters;
        else delete cfg.letterAnimations;

        const existingPathMorphs = Array.isArray(baseCfg.pathMorphAnimations)
            ? baseCfg.pathMorphAnimations.slice()
            : [];
        const restPathMorphs = existingPathMorphs.slice(1);
        const pathMorphs = pathMorph ? [pathMorph, ...restPathMorphs] : restPathMorphs;
        if (pathMorphs.length) cfg.pathMorphAnimations = pathMorphs;
        else delete cfg.pathMorphAnimations;

        cfg.textTransform = { ...textTransform };

        if (state.backgroundMode === 'layers' && Array.isArray(state.backgroundLayers) && state.backgroundLayers.length) {
            const serialized = state.backgroundLayers
                .map((layer) => {
                    if (!layer || !layer.type) return null;
                    const desc = deepCopy(layer);
                    desc.params = normalizeBackgroundParams(desc.type, desc.params || {});
                    if (!desc.colorAnimations || !desc.colorAnimations.length) delete desc.colorAnimations;
                    if (!desc.strokeAnimations || !desc.strokeAnimations.length) delete desc.strokeAnimations;
                    if (!desc.transformAnimations || !desc.transformAnimations.length)
                        delete desc.transformAnimations;
                    if (!desc.pathMorphAnimations || !desc.pathMorphAnimations.length)
                        delete desc.pathMorphAnimations;
                    if (!desc.letterAnimations || !desc.letterAnimations.length)
                        delete desc.letterAnimations;
                    if (!desc.fontFile) delete desc.fontFile;
                    if (!desc.text) delete desc.text;
                    return desc;
                })
                .filter(Boolean);
            if (serialized.length) cfg.backgroundLayers = serialized;
            else delete cfg.backgroundLayers;
        } else {
            delete cfg.backgroundLayers;
        }

        if (state.backgroundMode === 'knockout' && state.knockout) {
            const ko = deepCopy(state.knockout);
            if (!ko.colorAnimations || !ko.colorAnimations.length) delete ko.colorAnimations;
            if (!ko.strokeAnimations || !ko.strokeAnimations.length) delete ko.strokeAnimations;
            if (!ko.transformAnimations || !ko.transformAnimations.length) delete ko.transformAnimations;
            if (!ko.pathMorphAnimations || !ko.pathMorphAnimations.length) delete ko.pathMorphAnimations;
            cfg.knockoutBackground = ko;
        } else {
            delete cfg.knockoutBackground;
        }

        if (state.backgroundMode === 'knockout') {
            delete cfg.transformAnimations;
            delete cfg.colorAnimations;
            delete cfg.strokeAnimations;
            delete cfg.letterAnimations;
            delete cfg.pathMorphAnimations;
        }

        return cfg;
    }

    function loadConfigToForm(wrapper) {
        const cfg = wrapper.config || {};
        const nameInput = $('variantName');
        if (nameInput) {
            const nameFromWrapper =
                (typeof wrapper.name === 'string' && wrapper.name.trim()) ||
                (wrapper.meta && typeof wrapper.meta.name === 'string' && wrapper.meta.name.trim()) ||
                '';
            nameInput.value = nameFromWrapper || '';
        }
        $('frameRate').value = cfg.frameRate === 30 ? '30' : '60';
        updateDurationRange();
        if (cfg.duration != null) {
            setDurationValue(cfg.duration);
        } else {
            setDurationValue(parseInt($('duration').value || '0', 10) || 0);
        }
        if (cfg.fontFile) {
            $('fontFile').value = cfg.fontFile;
        }
        const textTransform = cfg.textTransform || {};
        state.textTransform = {
            scale: textTransform.scale != null ? textTransform.scale : 1,
            rotationDeg: textTransform.rotationDeg != null ? textTransform.rotationDeg : 0,
            offsetX: textTransform.offsetX != null ? textTransform.offsetX : 0,
            offsetY: textTransform.offsetY != null ? textTransform.offsetY : 0,
        };
        syncTextInputsFromState();
        updateBackgroundOverlay();
        $('enabled').checked = !!wrapper.enabled;

        state.backgroundMode = cfg.knockoutBackground ? 'knockout' : 'layers';
        const bgModeLayersRadio = document.getElementById('bgModeLayers');
        const bgModeKnockoutRadio = document.getElementById('bgModeKnockout');
        if (bgModeLayersRadio) bgModeLayersRadio.checked = state.backgroundMode === 'layers';
        if (bgModeKnockoutRadio) bgModeKnockoutRadio.checked = state.backgroundMode === 'knockout';

        state.backgroundLayers = state.backgroundMode === 'knockout' ? [] : deepCopy(cfg.backgroundLayers || []);
        state.activeBackgroundIndex = state.backgroundLayers.length ? 0 : null;
        state.knockout = cfg.knockoutBackground ? deepCopy(cfg.knockoutBackground) : makeDefaultKnockout();
        updateBackgroundVisibility();

        const transform = (cfg.transformAnimations && cfg.transformAnimations[0]) || null;
        const color = (cfg.colorAnimations && cfg.colorAnimations[0]) || null;
        const stroke = (cfg.strokeAnimations && cfg.strokeAnimations[0]) || null;
        const letter = (cfg.letterAnimations && cfg.letterAnimations[0]) || null;
        const pathMorph = (cfg.pathMorphAnimations && cfg.pathMorphAnimations[0]) || null;

        if (transform) {
            $('transformType').value = transform.type || 'none';
            ensureOption($('transformType'), transform.type, `${transform.type} (устарело)`);
        } else {
            $('transformType').value = 'none';
        }
        if (color) $('colorType').value = color.type || 'none';
        else $('colorType').value = '';
        if (stroke) $('strokeType').value = stroke.type || 'none';
        else $('strokeType').value = '';
        if (letter) $('letterType').value = letter.type || 'none';
        else $('letterType').value = 'none';
        if (pathMorph) $('pathMorphType').value = pathMorph.type || 'none';
        else $('pathMorphType').value = 'none';

        renderParams(
            $('transformParams'),
            transformSchema[$('transformType').value] || {},
            transform && transform.params,
            transformParamMeta[$('transformType').value] || null,
            getTransformDefaults($('transformType').value),
        );
        const colorValues = normalizeColorParamsForUi(color, cfg.fillColor, {
            isStatic: (color && color.type === 'none') || $('colorType').value === 'none',
        });
        renderColorParams($('colorParams'), $('colorType').value, colorValues);
        const strokeValues = normalizeColorParamsForUi(stroke, cfg.strokeColor, {
            isStroke: true,
            fallbackStrokeWidth:
                getStrokeWidthFromDescriptor(stroke) ??
                cfg.strokeWidth ??
                2,
            isStatic: (stroke && stroke.type === 'none') || $('strokeType').value === 'none',
        });
        renderColorParams($('strokeParams'), $('strokeType').value, strokeValues, { isStroke: true });
        renderParams(
            $('letterParams'),
            letterSchema[$('letterType').value] || {},
            letter && letter.params,
            letterParamMeta[$('letterType').value] || null,
            getLetterDefaults($('letterType').value),
        );
        renderParams(
            $('pathMorphParams'),
            pathMorphSchema[$('pathMorphType').value] || {},
            pathMorph && pathMorph.params,
            pathMorphParamMeta[$('pathMorphType').value] || null,
            getPathMorphDefaults($('pathMorphType').value),
        );
        updateLetterWarning();
        updatePathWarning();
        renderBackgroundLayers();
        renderKnockoutControls();
        renderPreviewLayersList();
    }

    function clearVariantPreview() {
        const vp = state.variantPreview;
        if (!vp) return;
        if (vp.timeoutId != null) {
            clearTimeout(vp.timeoutId);
            vp.timeoutId = null;
        }
        if (vp.instance && typeof vp.instance.destroy === 'function') {
            try {
                vp.instance.destroy();
            } catch (err) {
                console.error('Failed to destroy variant preview', err);
            }
        }
        if (vp.url) {
            try {
                URL.revokeObjectURL(vp.url);
            } catch (err) {
                // ignore
            }
        }
        if (vp.canvas && vp.canvas.getContext) {
            try {
                const ctx = vp.canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, vp.canvas.width, vp.canvas.height);
                }
            } catch (err) {
                console.error('Failed to clear variant preview canvas', err);
            }
        }
        const overlay = document.getElementById('variantPreview');
        if (overlay && overlay.classList) {
            overlay.classList.remove('visible');
            overlay.innerHTML = '';
        }
        vp.instance = null;
        vp.url = null;
        vp.canvas = null;
        vp.container = null;
        vp.activeId = null;
    }

    function scheduleVariantPreview(wrapper, anchorEl) {
        if (!anchorEl || !wrapper || !wrapper.id) return;
        const vp = state.variantPreview;
        clearVariantPreview();
        const overlay = document.getElementById('variantPreview');
        if (!overlay) return;
        const rect = anchorEl.getBoundingClientRect();
        const overlayHeight = 96;
        const margin = 8;
        let top = rect.top + rect.height / 2;
        const minTop = margin + overlayHeight / 2;
        const maxTop = window.innerHeight - margin - overlayHeight / 2;
        if (top < minTop) top = minTop;
        if (top > maxTop) top = maxTop;
        overlay.style.top = top + 'px';
        overlay.style.left = rect.right + 12 + 'px';
        overlay.classList.add('visible');
        vp.container = overlay;
        vp.activeId = wrapper.id;
        vp.timeoutId = window.setTimeout(() => {
            vp.timeoutId = null;
            loadVariantPreview(wrapper, overlay);
        }, 250);
    }

    async function loadVariantPreview(wrapper, container) {
        const vp = state.variantPreview;
        if (!container || !wrapper || !wrapper.id || vp.activeId !== wrapper.id) return;
        const textInput = $('previewText');
        let text = (textInput && textInput.value) || '';
        let trimmed = text.trim();
        if (!trimmed) {
            // Фолбэк, чтобы предпросмотр по hover всегда мог отрисоваться
            text = 'Пример текста';
            trimmed = text;
        }
        const DotLottie = window.DotLottie;
        if (!DotLottie) {
            return;
        }
        try {
            container.innerHTML = '';
            const canvas = document.createElement('canvas');
            canvas.className = 'variant-preview-canvas';
            container.appendChild(canvas);
            vp.canvas = canvas;

            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const targetW = rect.width || 56;
            const targetH = rect.height || 56;
            canvas.width = targetW * dpr;
            canvas.height = targetH * dpr;

            const res = await api('./api/preview', {
                method: 'POST',
                body: JSON.stringify({ text: trimmed, config: wrapper.config || {} }),
            });

            if (vp.activeId !== wrapper.id) {
                return;
            }

            const blobUrl = URL.createObjectURL(
                new Blob([JSON.stringify(res.sticker)], { type: 'application/json' }),
            );
            if (vp.url) {
                try {
                    URL.revokeObjectURL(vp.url);
                } catch {
                    // ignore
                }
            }
            vp.url = blobUrl;

            vp.instance = new DotLottie({
                canvas,
                autoplay: true,
                loop: true,
                src: blobUrl,
                renderConfig: {
                    autoResize: false,
                    devicePixelRatio: window.devicePixelRatio || 1,
                },
                layout: {
                    fit: 'contain',
                    align: [0.5, 0.5],
                },
            });
        } catch (err) {
            console.error('Failed to load hover preview', err);
        }
    }

    async function refreshVariants() {
        try {
            setStatus('Загрузка конфигураций…');
            const data = await api('./api/configs');
            state.variants = data.configs || [];
            renderVariants();
            setStatus('Готово');
        } catch (err) {
            console.error(err);
            setStatus('Ошибка загрузки конфигураций', true);
        }
    }

    function renderVariants() {
        const container = $('variantsList');
        const scrollContainer = container.querySelector('.variants-scroll') || container;
        scrollContainer.innerHTML = '';
        state.variants.forEach((v, idx) => {
            const item = document.createElement('div');
            item.className = 'variant-item' + (v.id === state.activeId ? ' active' : '');

            const title = document.createElement('div');
            title.className = 'variant-title';
            const label = document.createElement('span');
            label.className = 'variant-name';
            const variantName =
                (typeof v.name === 'string' && v.name.trim()) ||
                (v.meta && typeof v.meta.name === 'string' && v.meta.name.trim()) ||
                '';
            label.textContent = variantName || `Вариант ${idx + 1}`;
            const id = document.createElement('span');
            id.className = 'variant-id';
            id.textContent = v.id;
            title.appendChild(label);
            title.appendChild(id);

            const status = document.createElement('span');
            status.className = 'variant-status ' + (v.enabled ? 'enabled' : 'disabled');
            status.textContent = v.enabled ? 'Включен' : 'Выключен';

            item.appendChild(title);
            item.appendChild(status);

            item.addEventListener('click', () => {
                state.activeId = v.id;
                loadConfigToForm(v);
                renderVariants();
            });

            item.addEventListener('mouseenter', () => {
                scheduleVariantPreview(v, item);
            });

            item.addEventListener('mouseleave', () => {
                clearVariantPreview();
            });

            scrollContainer.appendChild(item);
        });
    }

    async function saveCurrentVariant() {
        try {
            const cfg = getCurrentConfig();
            const enabled = $('enabled').checked;
            const isNew = !state.activeId;
            const nameInput = $('variantName');
            const variantName = nameInput ? nameInput.value.trim() : '';
            const payload = { config: cfg, enabled };
            if (nameInput) {
                payload.name = variantName;
            }
            setStatus('Сохранение…');

            if (isNew) {
                const res = await api('./api/configs', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                state.activeId = res.id;
            } else {
                const res = await api(`./api/configs/${encodeURIComponent(state.activeId)}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });
                state.activeId = res.id;
            }

            await refreshVariants();
            setStatus('Сохранено');
        } catch (err) {
            console.error(err);
            setStatus('Ошибка сохранения', true);
        }
    }

    async function previewCurrent() {
        state.autoPreviewPending = false;
        try {
            const text = $('previewText').value || '';
            if (!text.trim()) {
                setStatus('Введите текст для предпросмотра', true);
                return;
            }
            const cfg = getCurrentConfig();
            setStatus('Генерация предпросмотра…');
            const res = await api('./api/preview', {
                method: 'POST',
                body: JSON.stringify({ text, config: cfg }),
            });

            const canvas = document.getElementById('previewCanvas');
            if (!canvas) {
                setStatus('Canvas для предпросмотра не найден', true);
                return;
            }
            const DotLottie = window.DotLottie;
            if (!DotLottie) {
                setStatus('DotLottie не загружен', true);
                return;
            }

            // Очистка старой анимации и canvas
            if (state.dotLottieInstance && typeof state.dotLottieInstance.destroy === 'function') {
                state.dotLottieInstance.destroy();
            }
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

            // Подгоняем размер canvas под контейнер (а не под w/h анимации),
            // чтобы масштаб был стабильным между предпросмотрами.
            const container = canvas.parentElement;
            if (container) {
                const rect = container.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                const targetW = rect.width || 360;
                const targetH = rect.height || 360;
                canvas.width = targetW * dpr;
                canvas.height = targetH * dpr;
            }

            const blobUrl = URL.createObjectURL(
                new Blob([JSON.stringify(res.sticker)], { type: 'application/json' }),
            );
            state.dotLottieUrl && URL.revokeObjectURL(state.dotLottieUrl);
            state.dotLottieUrl = blobUrl;

            state.dotLottieInstance = new DotLottie({
                canvas,
                autoplay: true,
                loop: true,
                src: blobUrl,
                renderConfig: {
                    autoResize: false,
                    devicePixelRatio: window.devicePixelRatio || 1,
                },
                layout: {
                    fit: 'contain',
                    align: [0.5, 0.5],
                },
            });

            updateBackgroundOverlay();
            $('sizeLabel').textContent = `${res.sizeKB} КБ (${res.sizeBytes} байт)`;
            setStatus('Предпросмотр обновлён');
        } catch (err) {
            console.error(err);
            setStatus('Ошибка генерации предпросмотра', true);
        }
    }

    async function init() {
        const frameRateSelect = $('frameRate');
        const durationSlider = $('durationSlider');
        const durationInput = $('duration');
        ensureLocalPaletteLoaded();

        // Глобальное плавающее окно предпросмотра варианта
        let overlay = document.getElementById('variantPreview');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'variantPreview';
            overlay.className = 'variant-preview';
            document.body.appendChild(overlay);
        }

        initBackgroundOverlay();

        $('newVariantBtn').addEventListener('click', () => {
            state.activeId = null;
            $('width').value = '';
            $('height').value = '';
            $('fontSize').value = '';
            const nameInput = $('variantName');
            if (nameInput) {
                nameInput.value = '';
            }
            const defaultFps =
                state.meta && state.meta.defaults && state.meta.defaults.frameRate === 30 ? '30' : '60';
            frameRateSelect.value = defaultFps;
            updateDurationRange();
            const defaultDuration =
                (state.meta && state.meta.defaults && state.meta.defaults.duration) || 0;
            setDurationValue(defaultDuration);
            if (state.meta && state.meta.defaults && state.meta.defaults.fontFile) {
                $('fontFile').value = state.meta.defaults.fontFile;
            } else {
                $('fontFile').value = '';
            }
            state.textTransform = { scale: 1, rotationDeg: 0, offsetX: 0, offsetY: 0 };
            syncTextInputsFromState();
            $('enabled').checked = true;
            $('transformType').value = 'none';
            $('colorType').value = 'none';
            $('strokeType').value = 'none';
            $('letterType').value = 'none';
            $('pathMorphType').value = 'none';
            renderParams(
                $('transformParams'),
                transformSchema[$('transformType').value] || {},
                {},
                transformParamMeta[$('transformType').value] || null,
                getTransformDefaults($('transformType').value),
            );
            renderColorParams($('colorParams'), 'none', defaultFillColorParams());
            renderColorParams($('strokeParams'), 'none', defaultStrokeColorParams(), { isStroke: true });
            renderParams(
                $('letterParams'),
                letterSchema[$('letterType').value] || {},
                {},
                letterParamMeta[$('letterType').value] || null,
                getLetterDefaults($('letterType').value),
            );
            renderParams(
                $('pathMorphParams'),
                pathMorphSchema[$('pathMorphType').value] || {},
                {},
                pathMorphParamMeta[$('pathMorphType').value] || null,
                getPathMorphDefaults($('pathMorphType').value),
            );
            updateLetterWarning();
            updatePathWarning();
            state.backgroundLayers = [];
            state.activeBackgroundIndex = null;
            state.knockout = makeDefaultKnockout();
            state.knockoutEnabled = false;
            state.backgroundMode = 'layers';
            const bgModeLayersRadio = document.getElementById('bgModeLayers');
            const bgModeKnockoutRadio = document.getElementById('bgModeKnockout');
            if (bgModeLayersRadio) bgModeLayersRadio.checked = true;
            if (bgModeKnockoutRadio) bgModeKnockoutRadio.checked = false;
            renderBackgroundLayers();
            renderKnockoutControls();
            renderPreviewLayersList();
            updateBackgroundVisibility();
            renderVariants();
            setStatus('Новый вариант');
        });

        frameRateSelect.addEventListener('change', () => {
            updateDurationRange();
        });
        durationSlider.addEventListener('input', () => {
            setDurationValue(parseInt(durationSlider.value || '0', 10) || 0);
        });
        durationInput.addEventListener('input', () => {
            setDurationValue(parseInt(durationInput.value || '0', 10) || 0);
        });
        ['textScale', 'textRotation', 'textOffsetX', 'textOffsetY'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', updateTextTransformFromInputs);
                el.addEventListener('change', updateTextTransformFromInputs);
            }
        });
        initTextTransformResetButtons();
        const fontSelectEl = $('fontFile');
        if (fontSelectEl) {
            fontSelectEl.addEventListener('change', updateFontFilePreview);
        }
        const previewTextInput = $('previewText');
        if (previewTextInput) {
            previewTextInput.addEventListener('input', updateFontFilePreview);
        }

        attachAutoPreviewListeners();

        $('refreshBtn').addEventListener('click', refreshVariants);
        $('saveBtn').addEventListener('click', saveCurrentVariant);
        $('previewBtn').addEventListener('click', previewCurrent);
        const autoPreviewToggle = $('autoPreview');
        if (autoPreviewToggle) {
            autoPreviewToggle.addEventListener('change', () => {
                state.autoPreview = autoPreviewToggle.checked;
                if (state.autoPreview) {
                    triggerAutoPreview();
                }
            });
            state.autoPreview = autoPreviewToggle.checked;
        }

        $('transformType').addEventListener('change', () => {
            const type = $('transformType').value;
            renderParams(
                $('transformParams'),
                transformSchema[type] || {},
                {},
                transformParamMeta[type] || null,
                getTransformDefaults(type),
            );
        });
        $('colorType').addEventListener('change', () => {
            const type = $('colorType').value;
            if (!type) {
                renderColorParams($('colorParams'), type, {});
                return;
            }
            const defaults = getColorDefaults(type) || defaultFillColorParams();
            renderColorParams($('colorParams'), type, defaults);
        });
        $('strokeType').addEventListener('change', () => {
            const type = $('strokeType').value;
            if (!type) {
                renderColorParams($('strokeParams'), type, {}, { isStroke: true });
                return;
            }
            const defaults = getColorDefaults(type) || defaultStrokeColorParams();
            if (typeof defaults.strokeWidth !== 'number') {
                defaults.strokeWidth = 2;
            }
            renderColorParams($('strokeParams'), type, defaults, { isStroke: true });
        });
        $('letterType').addEventListener('change', () => {
            const type = $('letterType').value;
            renderParams(
                $('letterParams'),
                letterSchema[type] || {},
                {},
                letterParamMeta[type] || null,
                getLetterDefaults(type),
            );
            updateLetterWarning();
        });
        $('pathMorphType').addEventListener('change', () => {
            const type = $('pathMorphType').value;
            renderParams(
                $('pathMorphParams'),
                pathMorphSchema[type] || {},
                {},
                pathMorphParamMeta[type] || null,
                getPathMorphDefaults(type),
            );
            updatePathWarning();
        });
        const bgModeLayersRadio = document.getElementById('bgModeLayers');
        const bgModeKnockoutRadio = document.getElementById('bgModeKnockout');
        if (bgModeLayersRadio) {
            bgModeLayersRadio.addEventListener('change', () => {
                if (bgModeLayersRadio.checked) setBackgroundMode('layers');
            });
        }
        if (bgModeKnockoutRadio) {
            bgModeKnockoutRadio.addEventListener('change', () => {
                if (bgModeKnockoutRadio.checked) setBackgroundMode('knockout');
            });
        }
        $('addBackgroundLayerBtn').addEventListener('click', () => {
            if (state.backgroundMode !== 'layers') return;
            const options = getBackgroundTypeOptions();
            const firstType = (options[0] && options[0].value) || 'solid';
            const layer = makeDefaultBackgroundLayer(firstType);
            state.backgroundLayers = Array.isArray(state.backgroundLayers) ? state.backgroundLayers : [];
            state.backgroundLayers.push(layer);
            state.activeBackgroundIndex = state.backgroundLayers.length - 1;
            renderBackgroundLayers();
        });

        fillSelect($('transformType'), [
            { value: 'none', label: 'Нет' },
            { value: 'slideLoop', label: 'SlideLoop' },
            { value: 'scalePulse', label: 'ScalePulse' },
            { value: 'shakeLoop', label: 'ShakeLoop' },
            { value: 'bounce', label: 'Bounce' },
            { value: 'vibrate', label: 'Vibrate' },
        ]);
        fillSelect($('colorType'), [
            { value: '', label: '— Отключено —' },
            { value: 'none', label: 'None (статичный)' },
            { value: 'zebra', label: 'Zebra (по буквам)' },
            { value: 'cycleRGB', label: 'CycleRGB' },
            { value: 'rainbow', label: 'Rainbow' },
            { value: 'chase', label: 'Огонёк (по буквам)' },
        ]);
        $('colorType').value = 'none';
        fillSelect($('strokeType'), [
            { value: '', label: '— Отключено —' },
            { value: 'none', label: 'None (статичный)' },
            { value: 'zebra', label: 'Zebra (по буквам)' },
            { value: 'cycleRGB', label: 'CycleRGB' },
            { value: 'rainbow', label: 'Rainbow' },
            { value: 'chase', label: 'Огонёк (по буквам)' },
        ]);
        $('strokeType').value = 'none';
        fillSelect($('letterType'), [
            { value: 'none', label: 'None' },
            { value: 'vibrate', label: 'Vibrate' },
            { value: 'typingFall', label: 'TypingFall' },
            { value: 'wave', label: 'Wave' },
            { value: 'zigzag', label: 'ZigZag' },
            { value: 'rotate', label: 'Rotate' },
            { value: 'snakeScale', label: 'SnakeScale' },
        ]);
        fillSelect($('pathMorphType'), [
            { value: 'none', label: 'None' },
            { value: 'warp', label: 'Warp' },
            { value: 'warpAiry', label: 'WarpAiry' },
            { value: 'skewPulse', label: 'SkewPulse' },
            { value: 'skewSwing', label: 'SkewSwing' },
        ]);

        renderParams(
            $('transformParams'),
            transformSchema[$('transformType').value] || {},
            {},
            transformParamMeta[$('transformType').value] || null,
            getTransformDefaults($('transformType').value),
        );
        renderColorParams($('colorParams'), $('colorType').value, defaultFillColorParams());
        renderColorParams($('strokeParams'), $('strokeType').value, defaultStrokeColorParams(), { isStroke: true });
        renderParams(
            $('letterParams'),
            letterSchema[$('letterType').value] || {},
            {},
            letterParamMeta[$('letterType').value] || null,
            getLetterDefaults($('letterType').value),
        );
        renderParams(
            $('pathMorphParams'),
            pathMorphSchema[$('pathMorphType').value] || {},
            {},
            pathMorphParamMeta[$('pathMorphType').value] || null,
            getPathMorphDefaults($('pathMorphType').value),
        );
        updateLetterWarning();
        updatePathWarning();
        updateLetterWarning();
        updatePathWarning();
        updateDurationRange();
        setDurationValue(parseInt(durationInput.value || '0', 10) || 0);
        renderBackgroundLayers();
        renderKnockoutControls();
        updateBackgroundVisibility();
        updateTextAnimationsAvailability();
        try {
            const meta = await api('./api/meta');
            state.meta = meta;
            if (meta && Array.isArray(meta.fonts)) {
                const fontSelect = $('fontFile');
                fontSelect.innerHTML = '';
                meta.fonts.forEach((name) => {
                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = name;
                    fontSelect.appendChild(opt);
                });
                if (meta.defaults && meta.defaults.fontFile) {
                    fontSelect.value = meta.defaults.fontFile;
                }
                updateFontFilePreview();
            }
            if (meta && meta.defaults) {
                const widthEl = $('width');
                const heightEl = $('height');
                const fontSizeEl = $('fontSize');
                const frameRateEl = $('frameRate');
                const durationEl = $('duration');
                if (widthEl) widthEl.placeholder = String(meta.defaults.width);
                if (heightEl) heightEl.placeholder = String(meta.defaults.height);
                if (fontSizeEl) fontSizeEl.placeholder = String(meta.defaults.fontSize);
                if (frameRateEl) frameRateEl.placeholder = String(meta.defaults.frameRate);
                if (durationEl) durationEl.placeholder = String(meta.defaults.duration);
                frameRateSelect.value = meta.defaults.frameRate === 30 ? '30' : '60';
                updateDurationRange();
                setDurationValue(meta.defaults.duration ?? 0);
            }
            renderBackgroundLayers();
            renderKnockoutControls();
            updateBackgroundVisibility();
        } catch (err) {
            console.error('Failed to load meta', err);
        }

        await refreshVariants();
        state.initialized = true;
        initPreviewViewportControls();
        renderPreviewLayersList();
    }

    window.addEventListener('DOMContentLoaded', init);
})();
