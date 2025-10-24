import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { share, LitShare } from '../src/share.js';

// Example 1: Basic shared counter
@customElement('counter-display')
class CounterDisplay extends LitElement {
  @share() count = 0;

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
      border: 2px solid #333;
      margin: 0.5rem;
    }
  `;

  render() {
    return html`
      <h3>Counter Display</h3>
      <p>Count: ${this.count}</p>
      <button @click=${() => this.count++}>Increment</button>
      <button @click=${() => this.count--}>Decrement</button>
    `;
  }
}

// Example 2: Another component sharing the same counter
@customElement('counter-viewer')
class CounterViewer extends LitElement {
  @share() count = 0;

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
      border: 2px solid #666;
      margin: 0.5rem;
      background: #f0f0f0;
    }
  `;

  render() {
    return html`
      <h3>Counter Viewer (Read Only)</h3>
      <p>Current count: ${this.count}</p>
      <p><em>This updates automatically when counter changes!</em></p>
    `;
  }
}

// Example 3: Custom key for sharing different property names
@customElement('user-profile')
class UserProfile extends LitElement {
  @share({ key: 'currentUser' }) user: { name: string; id: number } | null = null;

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
      border: 2px solid #3498db;
      margin: 0.5rem;
    }
  `;

  render() {
    return html`
      <h3>User Profile</h3>
      ${this.user
        ? html`<p>Logged in as: ${this.user.name} (ID: ${this.user.id})</p>`
        : html`<p>Not logged in</p>`}
    `;
  }
}

@customElement('user-control')
class UserControl extends LitElement {
  @share({ key: 'currentUser' }) currentUser: { name: string; id: number } | null = null;

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
      border: 2px solid #2ecc71;
      margin: 0.5rem;
    }
  `;

  private login() {
    this.currentUser = { name: 'Alice', id: 123 };
  }

  private logout() {
    this.currentUser = null;
  }

  render() {
    return html`
      <h3>User Control</h3>
      <button @click=${this.login}>Login</button>
      <button @click=${this.logout}>Logout</button>
    `;
  }
}

// Example 4: Custom hasChanged for object comparison
interface Data {
  id: number;
  value: string;
}

@customElement('data-display')
class DataDisplay extends LitElement {
  @share<Data | null>({
    key: 'appData',
    hasChanged: (newVal, oldVal) => {
      return !oldVal || newVal?.id !== oldVal.id;
    },
  })
  data: Data | null = null;

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
      border: 2px solid #e74c3c;
      margin: 0.5rem;
    }
  `;

  render() {
    return html`
      <h3>Data Display (Updates only when ID changes)</h3>
      ${this.data
        ? html`<p>ID: ${this.data.id}, Value: ${this.data.value}</p>`
        : html`<p>No data</p>`}
    `;
  }
}

@customElement('data-control')
class DataControl extends LitElement {
  @share({ key: 'appData' }) data: Data | null = null;

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
      border: 2px solid #9b59b6;
      margin: 0.5rem;
    }
  `;

  private setData(id: number, value: string) {
    this.data = { id, value };
  }

  render() {
    return html`
      <h3>Data Control</h3>
      <button @click=${() => this.setData(1, 'First')}>Set Data (ID: 1)</button>
      <button @click=${() => this.setData(1, 'Updated')}>
        Update value only (ID: 1, won't trigger display update)
      </button>
      <button @click=${() => this.setData(2, 'Second')}>Set Data (ID: 2)</button>
    `;
  }
}

// Example 5: Using type-safe get/set directly
@customElement('direct-api-example')
class DirectApiExample extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 1rem;
      border: 2px solid #f39c12;
      margin: 0.5rem;
    }
  `;

  private getCount() {
    const count = LitShare.get<number>('count', 0);
    alert(`Current count: ${count}`);
  }

  private setCount() {
    const newValue = prompt('Enter new count:');
    if (newValue !== null) {
      LitShare.set<number>('count', parseInt(newValue, 10) || 0);
    }
  }

  render() {
    return html`
      <h3>Direct API Example</h3>
      <p>Access shared values without @share decorator</p>
      <button @click=${this.getCount}>Get Count</button>
      <button @click=${this.setCount}>Set Count</button>
    `;
  }
}

// Example 6: Listener functionality
@customElement('listener-example')
class ListenerExample extends LitElement {
  private log: string[] = [];
  private unsubscribe?: () => void;

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
      border: 2px solid #16a085;
      margin: 0.5rem;
    }
    .log {
      background: #ecf0f1;
      padding: 0.5rem;
      margin-top: 0.5rem;
      max-height: 150px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 0.9em;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    // Add listener for count changes
    this.unsubscribe = LitShare.addListener<number>('count', (newValue, oldValue) => {
      this.log.push(`Count changed: ${oldValue} → ${newValue}`);
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up listener
    this.unsubscribe?.();
  }

  private clearLog() {
    this.log = [];
    this.requestUpdate();
  }

  render() {
    return html`
      <h3>Listener Example</h3>
      <p>Listens to count changes and logs them</p>
      <button @click=${this.clearLog}>Clear Log</button>
      <div class="log">
        ${this.log.length === 0
          ? html`<p><em>No changes yet. Try incrementing the counter above.</em></p>`
          : this.log.map((entry) => html`<div>${entry}</div>`)}
      </div>
    `;
  }
}

// Main example container
@customElement('lit-share-examples')
export class LitShareExamples extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 2rem;
      font-family: system-ui, sans-serif;
    }
    h2 {
      border-bottom: 2px solid #333;
      padding-bottom: 0.5rem;
    }
    .example-section {
      margin: 2rem 0;
    }
    .example-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
  `;

  render() {
    return html`
      <h1>lit-share Examples</h1>

      <div class="example-section">
        <h2>Example 1: Basic Shared Counter</h2>
        <p>
          Two components sharing the same counter. Changes in one are reflected in the other.
        </p>
        <div class="example-grid">
          <counter-display></counter-display>
          <counter-viewer></counter-viewer>
        </div>
      </div>

      <div class="example-section">
        <h2>Example 2: Custom Key</h2>
        <p>Different property names sharing the same value using a custom key.</p>
        <div class="example-grid">
          <user-control></user-control>
          <user-profile></user-profile>
        </div>
      </div>

      <div class="example-section">
        <h2>Example 3: Custom hasChanged</h2>
        <p>Using custom comparison logic. Display only updates when the ID changes.</p>
        <div class="example-grid">
          <data-control></data-control>
          <data-display></data-display>
        </div>
      </div>

      <div class="example-section">
        <h2>Example 4: Direct API Access</h2>
        <p>Using LitShare.get() and LitShare.set() directly without the decorator.</p>
        <direct-api-example></direct-api-example>
      </div>

      <div class="example-section">
        <h2>Example 5: Listeners</h2>
        <p>
          Listen to value changes outside of the component lifecycle. Try changing the counter
          above!
        </p>
        <listener-example></listener-example>
      </div>
    `;
  }
}
