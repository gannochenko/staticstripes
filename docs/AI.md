How this works:

## AI Provider Configuration

Similar to uploads, you define AI providers in the project file:

```html
<ai>
  <ai-music-api-ai name="music_api">
    <model name="sonic-v4-5" />
  </ai-music-api-ai>
</ai>
```

The `<model>` element is optional. If not specified, the default model for the provider will be used (e.g., `sonic-v4-5` for AIMusicAPI.ai).

## Asset AI Configuration

Assets can be configured to generate AI content using the `<ai>` tag:

```html
<asset data-name="mysterious_music" data-path="./audio/mysterious_music_01.mp3">
  <ai data-integration-name="music_api">
    <prompt>Generate a cool song!</prompt>
    <duration value="30" />
  </ai>
</asset>
```

- `data-integration-name`: References the AI integration name from the `<ai>` section
- `<prompt>`: The generation prompt (required)
- `<duration>`: Optional duration in seconds for generation (defaults to 30 seconds for music)

## How It Works

1. If the `data-path` file does not exist, it gets generated using the AI integration specified in `data-integration-name`
2. If the file exists, it is reused (no regeneration)
3. Generation happens automatically before rendering the video when running the "generate" command

## Authentication

Credentials are stored in `.auth/<ai_name>.json` with the following format:

```json
{
  "apiKey": "your-api-key-here"
}
```

For example, for the `music-api` provider, create `.auth/music-api.json` in your project directory.

## Strategy Pattern

The implementation uses a strategy pattern:
- Each AI provider tag (e.g., `<ai-music-api-ai>`) maps to a specific strategy implementation
- The strategy handles authentication, API requests, and file downloads
- Strategies are registered in `AIGenerationStrategyFactory`

## Supported Providers

### AIMusicAPI.ai (`<ai-music-api-ai>`)

Generates music using AIMusicAPI.ai's API (https://aimusicapi.ai).

**Important**: This uses **aimusicapi.ai**, NOT musicapi.ai (these are completely different services!)

**Provider tag:** `<ai-music-api-ai>`

**Configuration:**
- `<model name="sonic-v4-5" />` - Optional model selection (default: sonic-v4-5)

**Asset options:**
- `<prompt>` - Description of the music to generate (required)
- `<duration value="30" />` - Duration in seconds (optional, default: 30)

**Credentials format** (`.auth/<integration-name>.json`):
```json
{
  "apiKey": "your-aimusicapi-ai-api-key"
}
```

Get your API key from: https://aimusicapi.ai → Dashboard → API Keys
