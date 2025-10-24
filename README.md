# lit-share

A lightweight decorator for sharing reactive state across Lit elements, inspired by Lit's `@property` decorator.

## Features

- **Simple API**: Use `@share()` decorator just like `@property()`
- **Automatic synchronization**: Changes in one element instantly reflect in all others
- **Type-safe**: Full TypeScript support with generics
- **Performance optimized**: O(1) lookups with Map-based storage
- **Custom change detection**: Support for `hasChanged` like Lit's `@property`
- **Listener support**: Monitor value changes outside component lifecycle
- **Zero dependencies**: Only requires Lit as a peer dependency

## Installation

```bash
npm install lit-share
```

## Basic Usage

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

## Advanced Usage

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

### Type-Safe Direct API

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
  console.log(`Count changed: ${oldValue} � ${newValue}`);
});

// Remove listener
unsubscribe();

// Or remove directly
LitShare.removeListener('count', listener);
```

## API Reference

### `@share(options?)`

Decorator for creating shared properties.

**Options:**
- `key?: string` - Custom key for the shared value (defaults to property name)
- `hasChanged?: (newValue, oldValue) => boolean` - Custom change detection function

### `LitShare.get<T>(key, defaultValue?)`

Get a shared value with type safety.

**Parameters:**
- `key: string` - The shared value key
- `defaultValue?: T` - Default value if key doesn't exist

**Returns:** `T | undefined`

### `LitShare.set<T>(key, value, force?)`

Set a shared value and notify all registered elements.

**Parameters:**
- `key: string` - The shared value key
- `value: T` - The new value
- `force?: boolean` - Skip change detection and always update

### `LitShare.addListener<T>(key, listener)`

Add a listener for value changes.

**Parameters:**
- `key: string` - The shared value key
- `listener: (newValue: T, oldValue: T | undefined) => void` - Callback function

**Returns:** `() => void` - Unsubscribe function

### `LitShare.removeListener<T>(key, listener)`

Remove a listener.

**Parameters:**
- `key: string` - The shared value key
- `listener: ShareListener<T>` - The listener to remove

## Performance

lit-share uses a Map-based architecture for O(1) lookups and updates:

- Element registration: O(1)
- Value updates: O(n) where n is the number of subscribed elements
- Change detection: O(1)

## Examples

Check out the [examples](./examples) directory for more usage patterns.

## License

MIT
