"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const index_1 = require("./index");
/**
 * Example usage of the text sticker generator with different animations
 */
async function examples() {
    console.log('Generating stickers with different animations...\n');
    // Example 1: Static sticker
    console.log('1. Creating static sticker...');
    const staticSticker = await (0, index_1.generateTextSticker)({
        text: 'Привет',
        animationType: index_1.AnimationType.Static,
        fontSize: 80
    });
    await (0, index_1.saveStickerToFile)(staticSticker, path.resolve('./stickers/example_static.tgs'));
    console.log('   ✓ Saved to stickers/example_static.tgs\n');
    // Example 2: Slide left to right animation
    console.log('2. Creating slide animation...');
    const slideSticker = await (0, index_1.generateTextSticker)({
        text: 'Hello',
        animationType: index_1.AnimationType.SlideLeftToRight,
        fontSize: 70
    });
    await (0, index_1.saveStickerToFile)(slideSticker, path.resolve('./stickers/example_slide.tgs'));
    console.log('   ✓ Saved to stickers/example_slide.tgs\n');
    // Example 3: Scale (zoom in/out) animation
    console.log('3. Creating scale animation...');
    const scaleSticker = await (0, index_1.generateTextSticker)({
        text: 'WOW',
        animationType: index_1.AnimationType.Scale,
        fontSize: 90
    });
    await (0, index_1.saveStickerToFile)(scaleSticker, path.resolve('./stickers/example_scale.tgs'));
    console.log('   ✓ Saved to stickers/example_scale.tgs\n');
    // Example 4: Rotate animation
    console.log('4. Creating rotate animation...');
    const rotateSticker = await (0, index_1.generateTextSticker)({
        text: 'SPIN',
        animationType: index_1.AnimationType.Rotate,
        fontSize: 75
    });
    await (0, index_1.saveStickerToFile)(rotateSticker, path.resolve('./stickers/example_rotate.tgs'));
    console.log('   ✓ Saved to stickers/example_rotate.tgs\n');
    // Example 5: Shake animation
    console.log('5. Creating shake animation...');
    const shakeSticker = await (0, index_1.generateTextSticker)({
        text: 'BOOM',
        animationType: index_1.AnimationType.Shake,
        fontSize: 80
    });
    await (0, index_1.saveStickerToFile)(shakeSticker, path.resolve('./stickers/example_shake.tgs'));
    console.log('   ✓ Saved to stickers/example_shake.tgs\n');
    // Example 6: Color changing animation
    console.log('6. Creating color-changing animation...');
    const colorSticker = await (0, index_1.generateTextSticker)({
        text: 'Rainbow',
        animationType: index_1.AnimationType.ColorChange,
        fontSize: 60,
        duration: 120
    });
    await (0, index_1.saveStickerToFile)(colorSticker, path.resolve('./stickers/example_color.tgs'));
    console.log('   ✓ Saved to stickers/example_color.tgs\n');
    console.log('All example stickers generated successfully! 🎉');
    console.log('\nYou can now upload these .tgs files to Telegram as stickers.');
    console.log('\nAnimation types:');
    console.log('  - Static: No animation, just static text');
    console.log('  - SlideLeftToRight: Text slides in from left');
    console.log('  - Scale: Text zooms in with a bounce effect');
    console.log('  - Rotate: Each letter rotates 360 degrees');
    console.log('  - Shake: Text shakes rapidly');
    console.log('  - ColorChange: Text changes color (red → blue → red)');
}
// Run examples
examples().catch(console.error);
//# sourceMappingURL=example-usage.js.map