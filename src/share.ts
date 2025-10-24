import type { ReactiveElement } from 'lit';

/**
 * Listener function type for value changes.
 */
export type ShareListener<T = unknown> = (newValue: T, oldValue: T | undefined) => void;

/**
 * Default hasChanged implementation (same as Lit's default behavior).
 * Returns false if both values are NaN, otherwise uses strict inequality (!==).
 *
 * Note: `value === value` is false only when value is NaN.
 * If both are NaN, returns false (no change). Otherwise checks !==.
 */
export const defaultHasChanged = (value: unknown, oldValue: unknown): boolean => {
  return value !== oldValue && (value === value || oldValue === oldValue);
};

/**
 * Central registry for shared values across Lit elements.
 * Manages value storage, element subscriptions, and update notifications.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class LitShare {
  /** Shared values storage */
  static readonly values: Record<string, unknown> = {};

  /** Map<shareKey, Map<element, propertyNames[]>> - tracks which elements need updates for each shared value */
  static readonly requestUpdates: Map<string, Map<ReactiveElement, string[]>> = new Map();

  /** Custom hasChanged functions per shareKey */
  static readonly hasChangedFunctions: Map<string, (value: unknown, oldValue: unknown) => boolean> = new Map();

  /** Map<shareKey, Set<listener>> - listeners for value changes */
  static readonly listeners: Map<string, Set<ShareListener>> = new Map();

  public static findRequestUpdate(key: string, element: ReactiveElement): string[] | undefined {
    const elementMap = this.requestUpdates.get(key);
    if (elementMap) {
      return elementMap.get(element);
    }
    return undefined;
  }

  /**
   * Register an element to receive updates when a shared value changes.
   * @param key - The shared value key
   * @param element - The element to notify
   * @param target - The property name to update on the element (defaults to key)
   */
  public static register(key: string, element: ReactiveElement, target?: string): void {
    if (!target) {
      target = key;
    }

    if (!this.requestUpdates.has(key)) {
      this.requestUpdates.set(key, new Map());
    }

    const elementMap = this.requestUpdates.get(key)!;
    const targets = elementMap.get(element);

    if (!targets) {
      elementMap.set(element, [target]);
    } else if (!targets.includes(target)) {
      targets.push(target);
    }
  }

  public static unregister(key: string, element: ReactiveElement): void {
    const elementMap = this.requestUpdates.get(key);
    if (elementMap) {
      elementMap.delete(element);
    }
  }

  public static unregisterElement(element: ReactiveElement): void {
    for (const key of this.requestUpdates.keys()) {
      this.unregister(key, element);
    }
  }

  /**
   * Add a listener to be notified when a shared value changes.
   * @param key - The shared value key
   * @param listener - Function to call when value changes
   * @returns A function to remove the listener
   */
  public static addListener<T = unknown>(key: string, listener: ShareListener<T>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener as ShareListener);

    // Return unsubscribe function
    return () => this.removeListener(key, listener);
  }

  /**
   * Remove a listener for a shared value.
   * @param key - The shared value key
   * @param listener - The listener to remove
   */
  public static removeListener<T = unknown>(key: string, listener: ShareListener<T>): void {
    const listenerSet = this.listeners.get(key);
    if (listenerSet) {
      listenerSet.delete(listener as ShareListener);
    }
  }

  /**
   * Set a shared value and notify all registered elements.
   * @param key - The shared value key
   * @param value - The new value
   * @param force - If true, skip change detection and always update
   */
  public static set<T = unknown>(key: string, value: T, force?: boolean): void {
    const oldValue = this.values[key];

    // Skip update if value hasn't changed (unless forced)
    if (!force) {
      const hasChanged = this.hasChangedFunctions.get(key) ?? defaultHasChanged;
      if (!hasChanged(value, oldValue)) {
        return;
      }
    }

    this.values[key] = value;

    // Notify listeners
    const listenerSet = this.listeners.get(key);
    if (listenerSet) {
      for (const listener of listenerSet) {
        listener(value, oldValue);
      }
    }

    this.requestUpdate(key, oldValue, force);
  }

  public static get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    if (key in this.values) {
      return this.values[key] as T;
    }
    return defaultValue;
  }

  /**
   * Notify all registered elements that a shared value has changed.
   * @param key - The shared value key
   * @param oldValue - The previous value
   * @param force - If true, passes undefined as oldValue to force update
   */
  public static requestUpdate(key: string, oldValue?: unknown, force?: boolean): void {
    const elementMap = this.requestUpdates.get(key);
    if (elementMap) {
      for (const [element, targets] of elementMap.entries()) {
        for (const target of targets) {
          element.requestUpdate(target, force ? undefined : oldValue);
        }
      }
    }
  }
}

export interface ShareDeclaration<Type = unknown> {
  /**
   * Optional key for the shared value. If not provided, uses the property name.
   * Allows multiple properties to share the same value.
   */
  readonly key?: string;

  /**
   * A function that indicates if a property should be considered changed when
   * it is set. The function should take the `newValue` and `oldValue` and
   * return `true` if an update should be requested.
   */
  hasChanged?(value: Type, oldValue: Type): boolean;
}

/**
 * Decorator for creating shared properties across Lit elements.
 * Properties decorated with @share() synchronize their values across all elements.
 *
 * @example
 * ```typescript
 * class MyElement extends LitElement {
 *   @share() count = 0;  // Shared across all instances
 *   @share({ key: 'user' }) currentUser;  // Custom key
 *   @share({ hasChanged: (a, b) => a.id !== b.id }) data;  // Custom comparison
 * }
 * ```
 */
export function share<Type = unknown>(options?: ShareDeclaration<Type>): (target: ReactiveElement, propertyKey: string) => void {
  return function (target: ReactiveElement, key: string): void {
    const shareKey = options?.key ?? key;

    // Register custom hasChanged function if provided
    if (options?.hasChanged) {
      LitShare.hasChangedFunctions.set(shareKey, options.hasChanged as (value: unknown, oldValue: unknown) => boolean);
    }

    Object.defineProperty(target, key, {
      set: function (value: unknown): void {
        // Setting updates the shared value and notifies all subscribers
        void LitShare.set(shareKey, value);
      },
      get: function (): unknown {
        // Getting automatically registers this element for updates
        void LitShare.register(shareKey, this as ReactiveElement);
        return LitShare.get(shareKey);
      },
    } as PropertyDescriptor);
  };
}
