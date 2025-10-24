# CLAUDE.md

This document provides technical guidance and design rationale for lit-share, intended for developers who want to understand, use, or extend the library.

## Project Overview

**lit-share** is a decorator-based state sharing library for Lit elements, inspired by Lit's `@property` decorator API. It enables reactive state synchronization across multiple Lit components with minimal boilerplate.

## Core Concepts

### How It Works

1. **Decorator Registration**: When `@share()` is applied to a property, it replaces the property with a getter/setter
2. **Automatic Registration**: On getter access, the element automatically registers itself for updates
3. **Value Synchronization**: On setter call, the value is stored centrally and all registered elements are notified
4. **Reactive Updates**: Each registered element receives `requestUpdate()` calls, triggering Lit's normal rendering cycle

### Key Principles

- **Automatic**: No manual subscription management required
- **Declarative**: State sharing defined at property level
- **Type-safe**: Full TypeScript support with generics
- **Performance-focused**: O(1) lookups using Map-based storage
- **Lit-compatible**: Follows Lit's patterns and conventions

## Usage Guide

### Basic Pattern

```typescript
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { share } from 'lit-share';

@customElement('my-element')
class MyElement extends LitElement {
  @share() count = 0;  // Shared across all instances

  render() {
    return html`<p>${this.count}</p>`;
  }
}
```

**What happens:**
1. Each instance creates its own getter/setter for `count`
2. First access to `this.count` registers the element
3. Setting `this.count` updates all registered elements
4. Initial value (`= 0`) is set via the setter on instantiation

### Custom Keys

Use when different property names should share the same value:

```typescript
@customElement('profile-view')
class ProfileView extends LitElement {
  @share({ key: 'currentUser' }) user = null;
}

@customElement('profile-editor')
class ProfileEditor extends LitElement {
  @share({ key: 'currentUser' }) currentUser = null;
}
```

Both components share the same underlying value via the `'currentUser'` key.

### Change Detection

Control when updates trigger re-renders:

```typescript
interface User {
  id: number;
  name: string;
}

@customElement('user-display')
class UserDisplay extends LitElement {
  @share<User | null>({
    key: 'user',
    hasChanged: (newVal, oldVal) => {
      // Only update if user ID changes
      return !oldVal || newVal?.id !== oldVal.id;
    }
  })
  user: User | null = null;
}
```

**Common patterns:**
- Deep equality: `JSON.stringify(a) !== JSON.stringify(b)`
- Reference equality: `a !== b` (default)
- Property-based: `a?.id !== b?.id`
- Always update: `() => true`

### Direct API Access

Use when you need to access shared values outside of decorators:

```typescript
import { LitShare } from 'lit-share';

// Read value
const count = LitShare.get<number>('count', 0);

// Write value
LitShare.set<number>('count', 42);

// Force update (skip hasChanged check)
LitShare.set<number>('count', 42, true);
```

### Listening to Changes

Monitor value changes from anywhere in your application:

```typescript
import { LitShare } from 'lit-share';

// In a service, utility, or non-Lit code
const unsubscribe = LitShare.addListener<number>('count', (newVal, oldVal) => {
  console.log(`Count changed from ${oldVal} to ${newVal}`);
  // Analytics, logging, side effects, etc.
});

// Clean up when done
unsubscribe();
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

## Design Decisions

### 1. Initial Value Handling

**Decision**: Use field initializers (e.g., `@share() count = 0`)

**Why:**
- Natural TypeScript/JavaScript syntax
- Automatic setter invocation on instantiation
- No duplicate declarations

**Caveat:**
If multiple components have different initial values, the last-initialized component's value becomes the shared value. This is expected behavior for "shared" state.

**Example:**
```typescript
// Component A: @share() count = 0
// Component B: @share() count = 100
// If B is created after A, count becomes 100 for both
```

### 2. Automatic Registration on Read

**Decision**: Register element on property getter access

**Why:**
- Zero boilerplate for developers
- Lazy registration (only when property is used)
- Natural integration with Lit's reactive update cycle

**Trade-off:**
Elements that never read the property won't receive updates. This is usually desired (unused properties shouldn't trigger renders).

### 3. Map-Based Storage

**Decision**: Use `Map<string, Map<ReactiveElement, string[]>>` for element registry

**Why:**
- O(1) element lookup vs O(n) with arrays
- Efficient add/remove operations
- Natural key-value semantics

**Structure:**
```
shareKey → element → [propertyName1, propertyName2, ...]
```

This allows one element to use the same shared value for multiple properties.

### 4. hasChanged Default Behavior

**Decision**: Match Lit's default `hasChanged` implementation

**Implementation:**
```typescript
value !== oldValue && (value === value || oldValue === oldValue)
```

**Why:**
- Consistent with Lit ecosystem
- Proper NaN handling (`NaN === NaN` considered "no change")
- Familiar to Lit developers

**NaN explanation:**
- `NaN === NaN` is `false` in JavaScript
- `NaN !== NaN` is `true` (would trigger update)
- `NaN === NaN` evaluates to `false` (prevents update)
- Only when neither value is NaN does the `!==` check matter

### 5. Listener Timing

**Decision**: Call listeners before `requestUpdate()`

**Why:**
- Listeners observe changes before DOM updates
- Allows side effects to run before rendering
- Predictable execution order

**Order of operations:**
1. Value is set in storage
2. Listeners are called
3. Elements receive `requestUpdate()`
4. Lit schedules re-renders

## Architecture

### Data Flow

```
User sets property
       ↓
    Setter
       ↓
LitShare.set()
       ↓
  hasChanged?
    ↙     ↘
  No      Yes
 skip      ↓
     Store value
          ↓
   Call listeners
          ↓
    requestUpdate()
     on all elements
          ↓
   Lit re-renders
```

### Storage Structure

```typescript
class LitShare {
  // Central value storage
  static values: Record<string, unknown>

  // Element subscriptions: shareKey → element → property names
  static requestUpdates: Map<string, Map<ReactiveElement, string[]>>

  // Custom change detection per key
  static hasChangedFunctions: Map<string, (value, oldValue) => boolean>

  // External listeners per key
  static listeners: Map<string, Set<ShareListener>>
}
```

## Common Patterns

### Shared Application State

```typescript
// App state
@customElement('app-root')
class AppRoot extends LitElement {
  @share({ key: 'theme' }) theme = 'light';
  @share({ key: 'user' }) user = null;
}

// Child components
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

### Form State Sharing

```typescript
@customElement('form-input')
class FormInput extends LitElement {
  @share({ key: 'formData' }) data: FormData = {};

  updateField(field: string, value: unknown) {
    this.data = { ...this.data, [field]: value };
  }
}

@customElement('form-preview')
class FormPreview extends LitElement {
  @share({ key: 'formData' }) data: FormData;

  render() {
    return html`<pre>${JSON.stringify(this.data, null, 2)}</pre>`;
  }
}
```

## Known Limitations

1. **Initial value conflicts**: Last-initialized element determines shared value when initial values differ
2. **Memory only**: No built-in persistence (use listeners to implement if needed)
3. **Synchronous**: No support for async value updates
4. **No middleware**: Simple design without plugin/middleware system

## Troubleshooting

### Property not updating

**Cause**: Element not registered (property never read)
**Solution**: Ensure the property is accessed in `render()` or another lifecycle method

### Unexpected initial value

**Cause**: Multiple elements with different initial values
**Solution**: Use a single source of truth, or set value explicitly before creating elements

### Performance issues

**Cause**: Too many elements subscribed, or expensive `hasChanged` functions
**Solution**: Profile with browser DevTools, optimize `hasChanged`, or batch operations

### Memory leaks

**Cause**: Elements not properly unregistered, or listeners not cleaned up
**Solution**: Ensure elements are removed from DOM, call `unsubscribe()` on listeners

## Development

### Building

```bash
npm run build
```

### Running Examples

```bash
npm run dev
```

Then open `http://localhost:8000/examples/`

### Project Structure

```
lit-share/
├── src/
│   ├── share.ts          # Core implementation
│   └── index.ts          # Public exports
├── examples/
│   ├── lit-share-examples.ts  # Interactive examples
│   └── index.html        # Example page
├── dist/                 # Build output
└── README.md            # User documentation
```

## Extending lit-share

### Adding Middleware

If you need to intercept operations:

```typescript
const originalSet = LitShare.set.bind(LitShare);
LitShare.set = function<T>(key: string, value: T, force?: boolean) {
  console.log(`Setting ${key} to`, value);
  return originalSet(key, value, force);
};
```

### Adding Persistence

```typescript
LitShare.addListener('key', (newVal) => {
  localStorage.setItem('key', JSON.stringify(newVal));
});

// On app start
const saved = localStorage.getItem('key');
if (saved) {
  LitShare.set('key', JSON.parse(saved));
}
```

### Computed Values

```typescript
LitShare.addListener('firstName', updateFullName);
LitShare.addListener('lastName', updateFullName);

function updateFullName() {
  const first = LitShare.get<string>('firstName', '');
  const last = LitShare.get<string>('lastName', '');
  LitShare.set('fullName', `${first} ${last}`);
}
```

## Best Practices

1. **Use TypeScript**: Leverage generics for type safety
2. **Name keys explicitly**: Use `key` option for important shared state
3. **Implement hasChanged for objects**: Avoid unnecessary re-renders
4. **Clean up listeners**: Always unsubscribe in `disconnectedCallback`
5. **Set initial values consistently**: Avoid conflicts by using a single source
6. **Document shared state**: Comment which values are shared and why
7. **Test edge cases**: null, undefined, NaN, empty objects/arrays

## References

- [Lit Documentation](https://lit.dev)
- [Lit @property decorator](https://lit.dev/docs/components/properties/)
- [TypeScript Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html)

## Support

For issues, questions, or contributions, visit:
- GitHub: https://github.com/mizushino/lit-share
- Issues: https://github.com/mizushino/lit-share/issues

---

This project was developed with assistance from Claude (Anthropic), which helped with architecture design, implementation, optimization, and documentation.
