# lit-share

[![npm version](https://badge.fury.io/js/lit-share.svg)](https://www.npmjs.com/package/lit-share)
[![npm downloads](https://img.shields.io/npm/dm/lit-share.svg)](https://www.npmjs.com/package/lit-share)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)
![Tree Shakeable](https://img.shields.io/badge/Tree%20Shakeable-Yes-brightgreen)

A lightweight decorator for sharing reactive state across Lit elements.

**✨ Key Features:**
- **Simple API** - Use `@share()` decorator just like `@property()`
- **Automatic synchronization** - Changes in one element instantly reflect in all others
- **Type-safe** - Full TypeScript support with generics
- **Performance optimized** - O(1) lookups with Map-based storage
- **Custom change detection** - Support for `hasChanged` like Lit's `@property`
- **Listener support** - Monitor value changes outside component lifecycle

## Installation

```sh
npm install lit-share
```

## Usage

### Basic Sharing

Share state across multiple elements with a simple decorator:

```typescript
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { share } from 'lit-share';

@customElement('counter-display')
class CounterDisplay extends LitElement {
  @share() count = 0;

  render() {
    return html`
      <p>Count: ${this.count}</p>
      <button @click=${() => this.count++}>Increment</button>
    `;
  }
}

@customElement('counter-viewer')
class CounterViewer extends LitElement {
  @share() count = 0;

  render() {
    return html`<p>Current count: ${this.count}</p>`;
  }
}
```

Both components share the same `count` value. Clicking the button in `counter-display` automatically updates `counter-viewer`.

### Custom Key

Share the same value with different property names:

```typescript
@customElement('user-profile')
class UserProfile extends LitElement {
  @share({ key: 'currentUser' }) user = null;

  render() {
    return html`<p>User: ${this.user?.name}</p>`;
  }
}

@customElement('user-settings')
class UserSettings extends LitElement {
  @share({ key: 'currentUser' }) currentUser = null;

  render() {
    return html`<p>Settings for: ${this.currentUser?.name}</p>`;
  }
}
```

### Custom Change Detection

Use custom comparison logic like Lit's `hasChanged`:

```typescript
interface Data {
  id: number;
  value: string;
}

@customElement('data-display')
class DataDisplay extends LitElement {
  @share<Data | null>({
    key: 'appData',
    hasChanged: (newVal, oldVal) => {
      // Only update when ID changes
      return !oldVal || newVal?.id !== oldVal.id;
    }
  })
  data: Data | null = null;

  render() {
    return html`<p>ID: ${this.data?.id}, Value: ${this.data?.value}</p>`;
  }
}
```

**Common patterns:**
- Deep equality: `JSON.stringify(a) !== JSON.stringify(b)`
- Reference equality: `a !== b` (default)
- Property-based: `a?.id !== b?.id`
- Always update: `() => true`

### Direct API Access

Access shared values without the decorator:

```typescript
import { LitShare } from 'lit-share';

// Get with type safety
const count = LitShare.get<number>('count', 0);

// Set with type safety
LitShare.set<number>('count', 42);

// Force update (skip change detection)
LitShare.set<number>('count', 42, true);
```

### Listeners

Monitor value changes outside of element lifecycle:

```typescript
import { LitShare } from 'lit-share';

// Add listener
const unsubscribe = LitShare.addListener<number>('count', (newValue, oldValue) => {
  console.log(`Count changed: ${oldValue} → ${newValue}`);
});

// Remove listener
unsubscribe();

// Or remove directly
LitShare.removeListener('count', listener);
```

**Lifecycle integration:**

```typescript
class MyElement extends LitElement {
  private unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribe = LitShare.addListener('key', this.handleChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
  }

  private handleChange = (newVal: unknown, oldVal: unknown) => {
    // Handle change
  }
}
```

## API Reference

### `@share(options?)`

Decorator for creating shared properties.

```typescript
@share<T>(options?: ShareDeclaration<T>)
```

**Options:**
- `key?: string` - Custom key for the shared value (defaults to property name)
- `hasChanged?: (newValue: T, oldValue: T) => boolean` - Custom change detection function

### `LitShare.get<T>(key, defaultValue?)`

Get a shared value with type safety.

```typescript
LitShare.get<T>(key: string, defaultValue?: T): T | undefined
```

**Parameters:**
- `key: string` - The shared value key
- `defaultValue?: T` - Default value if key doesn't exist

**Returns:** `T | undefined`

### `LitShare.set<T>(key, value, force?)`

Set a shared value and notify all registered elements.

```typescript
LitShare.set<T>(key: string, value: T, force?: boolean): void
```

**Parameters:**
- `key: string` - The shared value key
- `value: T` - The new value
- `force?: boolean` - Skip change detection and always update

### `LitShare.addListener<T>(key, listener)`

Add a listener for value changes.

```typescript
LitShare.addListener<T>(key: string, listener: (newValue: T, oldValue: T | undefined) => void): () => void
```

**Parameters:**
- `key: string` - The shared value key
- `listener: (newValue: T, oldValue: T | undefined) => void` - Callback function

**Returns:** `() => void` - Unsubscribe function

### `LitShare.removeListener<T>(key, listener)`

Remove a listener.

```typescript
LitShare.removeListener<T>(key: string, listener: ShareListener<T>): void
```

**Parameters:**
- `key: string` - The shared value key
- `listener: ShareListener<T>` - The listener to remove

## How It Works

1. **Decorator Registration**: When `@share()` is applied to a property, it replaces the property with a getter/setter
2. **Automatic Registration**: On getter access, the element automatically registers itself for updates
3. **Value Synchronization**: On setter call, the value is stored centrally and all registered elements are notified
4. **Reactive Updates**: Each registered element receives `requestUpdate()` calls, triggering Lit's normal rendering cycle

## Performance

lit-share uses a Map-based architecture for O(1) lookups and updates:

- Element registration: O(1)
- Value updates: O(n) where n is the number of subscribed elements
- Change detection: O(1)

## Common Patterns

### Shared Application State

```typescript
@customElement('app-root')
class AppRoot extends LitElement {
  @share({ key: 'theme' }) theme = 'light';
  @share({ key: 'user' }) user = null;
}

@customElement('theme-toggle')
class ThemeToggle extends LitElement {
  @share({ key: 'theme' }) theme: string;

  toggle() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
  }
}
```

### Global Counters/Flags

```typescript
@customElement('loading-spinner')
class LoadingSpinner extends LitElement {
  @share() loadingCount = 0;

  render() {
    return this.loadingCount > 0
      ? html`<div class="spinner"></div>`
      : html``;
  }
}

// Elsewhere
function startLoading() {
  LitShare.set('loadingCount', LitShare.get('loadingCount', 0) + 1);
}

function stopLoading() {
  LitShare.set('loadingCount', Math.max(0, LitShare.get('loadingCount', 0) - 1));
}
```

## Best Practices

1. **Use TypeScript** - Leverage generics for type safety
2. **Name keys explicitly** - Use `key` option for important shared state
3. **Implement hasChanged for objects** - Avoid unnecessary re-renders
4. **Clean up listeners** - Always unsubscribe in `disconnectedCallback`
5. **Set initial values consistently** - Avoid conflicts by using a single source
6. **Document shared state** - Comment which values are shared and why

## Examples

Check out the [examples](./examples) directory for more usage patterns.

## License

MIT

## Author

mizushino
