# Redis Configuration System

## Overview

The sticker bot now uses Redis to store and manage sticker configurations dynamically. This allows you to:

- Enable/disable individual sticker variants without restarting the bot
- Add new sticker configurations on the fly
- Manage configurations through bot commands or scripts

## Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Redis connection
REDIS_URL=redis://localhost:6379

# Admin user IDs (comma-separated) for configuration management
ADMIN_USER_IDS=123456789,987654321
```

## Initialization

Before running the bot for the first time with Redis configurations, you need to initialize the default configurations:

### Option 1: Using npm script

```bash
npm run init-configs
```

### Option 2: Using bot command

1. Start the bot
2. Send `/init_configs` command (admin only)

This will load all 29 default sticker variants into Redis as enabled configurations.

## Bot Commands

### Admin Commands

All admin commands require the user ID to be in the `ADMIN_USER_IDS` environment variable.

#### `/list_configs`

Lists all sticker configurations with their enabled/disabled status.

```
Example output:
📋 Sticker Configurations (29 total)

✅ a1b2c3d4e5f6g7h8
✅ i9j0k1l2m3n4o5p6
❌ q7r8s9t0u1v2w3x4
...

📊 Summary:
• Total: 29
• Enabled: 25
• Disabled: 4
```

#### `/enable <config_id>`

Enables a specific sticker configuration.

```bash
/enable a1b2c3d4e5f6g7h8
```

Response: `✅ Configuration a1b2c3d4e5f6g7h8 has been enabled.`

#### `/disable <config_id>`

Disables a specific sticker configuration.

```bash
/disable a1b2c3d4e5f6g7h8
```

Response: `✅ Configuration a1b2c3d4e5f6g7h8 has been disabled.`

#### `/view_config <config_id>`

Shows detailed information about a specific configuration.

```bash
/view_config a1b2c3d4e5f6g7h8
```

Response shows the full JSON configuration including animations, colors, and styles.

#### `/init_configs`

Initializes Redis with the default 29 sticker configurations. Use this if Redis is empty or you want to reset to defaults.

## Redis Data Structure

### Configuration Keys

- **Config Storage**: `config:<config_id>`

  - Value: JSON string of the sticker configuration
  - Example: `config:a1b2c3d4e5f6g7h8`

- **Enabled Set**: `config:enabled`
  - Type: Redis Set
  - Contains: All enabled configuration IDs

### Sticker Cache Keys

- **Cached Stickers**: `sticker:<text_hash>:<config_hash>`
  - Value: Telegram file_id
  - Example: `sticker:5d41402abc4b2a76b9719d911017c592:e99a18c428cb38d5f260853678922e03`

## Configuration ID Generation

Configuration IDs are generated as SHA-256 hashes (truncated to 16 characters) of the JSON-serialized configuration. This ensures:

- Unique IDs for each configuration
- Deterministic IDs (same config = same ID)
- No duplicate configurations

## Workflow

1. **Initialization**: Load default configurations into Redis
2. **Bot Start**: Bot loads enabled configurations from Redis
3. **Inline Query**: Bot generates stickers using only enabled configurations
4. **Management**: Admins can enable/disable configs without restarting the bot
5. **Dynamic Updates**: Changes take effect immediately for new inline queries

## Adding New Configurations

To add a new sticker configuration programmatically:

```typescript
import { stickerConfigManager } from './cache';
import { TransformAnimationType, ColorAnimationType } from './index';

const newConfig = {
  transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
  colorAnimations: [{ type: ColorAnimationType.Rainbow }],
  fillColor: [1, 1, 1],
};

const configId = await stickerConfigManager.saveConfig(newConfig, true);
console.log(`Created config with ID: ${configId}`);
```

## Migration from Hardcoded Variants

The old `STICKER_VARIANTS` array is still present in the code but is only used by the `/init_configs` command. The bot now dynamically loads configurations from Redis, making it fully flexible and manageable at runtime.

## Troubleshooting

### No stickers appearing

1. Check if Redis is running: `redis-cli ping`
2. Check if configurations are initialized: `/list_configs`
3. If empty, run: `/init_configs` or `npm run init-configs`

### Admin commands not working

1. Verify your user ID is in `ADMIN_USER_IDS` environment variable
2. Get your user ID by sending any message to the bot (it will log it)

### Configuration changes not taking effect

- Changes take effect immediately for new inline queries
- Old cached stickers remain until cache expires or is cleared
- No bot restart required for configuration changes
