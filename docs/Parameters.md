# Parameter Schema System

Applications built with `@gannochenko/viewer-tools` use a parameter schema system to define and manage dynamic content fields.

## Overview

An application has parameters that control its content. Currently, only string-type parameters are supported.

There are **3 standard parameters** that are automatically injected by StaticStripes:
- `title` - Video title
- `date` - Video date (ISO 8601 format)
- `tags` - Comma-separated tags

Applications can define **additional custom parameters** beyond these three standard ones.

## How It Works

1. **Schema Definition**: Parameters are defined in a schema structure within the app
2. **Preview Panel**: The `PreviewPanel` component automatically renders input fields based on the schema
3. **URL Parameters**: In rendering mode, parameters come from URL query strings
4. **LocalStorage**: During preview mode, parameter values are persisted to localStorage

## Defining a Parameter Schema

Create a schema file in your app:

**File: `src/schema.ts`**

```typescript
import type { ParameterSchema } from "@gannochenko/viewer-tools";

export const PARAMETER_SCHEMA: ParameterSchema = {
  fields: [
    {
      name: "title",
      label: "Title",
      placeholder: "My Video Title",
      defaultValue: "Central Text",
    },
    {
      name: "date",
      label: "Date",
      placeholder: "2025-01-15",
      defaultValue: "",
    },
    {
      name: "tags",
      label: "Tags",
      placeholder: "travel,vlog",
      defaultValue: "",
    },
    {
      name: "extra",
      label: "Extra text",
      placeholder: "Thanks for watching!",
      defaultValue: "",
    },
  ],
};

// Define typed interface matching your schema
export interface AppParams {
  title: string;
  date: string;
  tags: string;
  extra: string;
  [key: string]: string; // Index signature required for ContentParams
}
```

## Using the Schema in Your App

**File: `src/App.tsx`**

```tsx
import { VideoFrame } from "@gannochenko/viewer-tools";
import { PARAMETER_SCHEMA, type AppParams } from "./schema";

function App() {
  const params = useAppParams();

  return (
    <VideoFrame<AppParams>
      storageKey="my-app:content"
      initialContent={params}
      schema={PARAMETER_SCHEMA}
    >
      {(content) => <YourContent {...content} />}
    </VideoFrame>
  );
}
```

## Parameter Field Properties

Each field in the schema supports:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Parameter name (used as key) |
| `label` | `string` | Yes | Human-readable label for UI |
| `placeholder` | `string` | No | Placeholder text for input field |
| `defaultValue` | `string` | No | Default value if not provided |

## Standard vs Custom Parameters

**Standard Parameters** (always available):
- `title` - Video title from `<title>` tag
- `date` - Video date from `<date>` tag
- `tags` - Tags from `<tag>` elements

**Custom Parameters**:
- Any additional fields defined in your schema
- Must be passed via `data-parameters` in `<app>` element

## Example: Using Custom Parameters

**In project.html:**

```html
<fragment class="title_overlay">
  <app
    src="../apps/my-app/dst"
    data-parameters='{"extra": "🎬", "author": "John Doe"}'
  />
</fragment>
```

**In schema.ts:**

```typescript
export const PARAMETER_SCHEMA: ParameterSchema = {
  fields: [
    { name: "title", label: "Title", defaultValue: "" },
    { name: "date", label: "Date", defaultValue: "" },
    { name: "tags", label: "Tags", defaultValue: "" },
    { name: "extra", label: "Extra", defaultValue: "" },
    { name: "author", label: "Author", defaultValue: "" },
  ],
};
```

## Benefits

✅ **Type-safe** - Define typed interfaces matching your schema
✅ **Auto-generated UI** - PreviewPanel renders fields automatically
✅ **Persistent** - Values saved to localStorage during development
✅ **Flexible** - Add custom parameters beyond the standard three
✅ **Consistent** - Standard parameters work the same across all apps

## Best Practices

1. **Always include standard parameters** (title, date, tags) in your schema
2. **Use meaningful labels** for better UX in the preview panel
3. **Provide placeholders** to guide users on expected format
4. **Set sensible defaults** to improve initial preview experience
5. **Keep the index signature** `[key: string]: string` for TypeScript compatibility
