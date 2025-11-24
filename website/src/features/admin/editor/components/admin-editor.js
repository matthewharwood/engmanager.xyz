// Admin Editor Web Component
// Main container coordinating all editor components
// Using web-components-architecture and javascript-pragmatic-rules skills

// Using attribute-driven state pattern from web-components-architecture
class AdminEditor extends HTMLElement {
  #routeName = 'homepage';
  #abortController = null;
  #timeout = 5_000; // 5 second timeout
  #tabSwitcher = null;
  #blockList = null;
  #jsonEditor = null;
  #messageBanner = null;
  #cleanup = [];

  // Principle 2: Attribute-Driven State from web-components-architecture
  static get observedAttributes() {
    return ['data-route-name'];
  }

  // Lifecycle callback from web-components-architecture
  connectedCallback() {
    // Using handleEvent pattern from web-components-architecture
    this.addEventListener('submit', this);
    this.addEventListener('tab-changed', this);
    this.addEventListener('blocks-changed', this);
    this.addEventListener('json-valid', this);

    // Set ARIA attributes for accessibility
    this.setAttribute('role', 'main');
    this.setAttribute('aria-label', 'Admin content editor');

    // Get route name
    this.#routeName = this.getAttribute('data-route-name') || 'homepage';

    this.#initializeComponents();
    this.#loadInitialData();
  }

  // Rule 4 from javascript-pragmatic-rules: Clean up resources
  disconnectedCallback() {
    this.removeEventListener('submit', this);
    this.removeEventListener('tab-changed', this);
    this.removeEventListener('blocks-changed', this);
    this.removeEventListener('json-valid', this);

    // Cancel any pending requests
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }

    // Rule 17 from javascript-pragmatic-rules: Comprehensive cleanup
    for (const fn of this.#cleanup) fn();
    this.#cleanup = [];
  }

  // Principle 2: React to attribute changes from web-components-architecture
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'data-route-name') {
      this.#routeName = newValue || 'homepage';
    }
  }

  // Principle 3: HandleEvent pattern from web-components-architecture
  handleEvent(e) {
    switch (e.type) {
      case 'submit':
        this.#handleSubmit(e);
        break;
      case 'tab-changed':
        this.#handleTabChanged(e);
        break;
      case 'blocks-changed':
        this.#handleBlocksChanged(e);
        break;
      case 'json-valid':
        this.#handleJsonValid(e);
        break;
    }
  }

  #initializeComponents() {
    // Principle 1: Zero DOM Selection - EXCEPTION for parent-child component coordination
    // We need to find direct child custom elements for coordination
    // This is acceptable because we're coordinating a known component tree structure
    this.#tabSwitcher = this.querySelector('tab-switcher');
    this.#blockList = this.querySelector('block-list');
    this.#jsonEditor = this.querySelector('monaco-json-editor');
    this.#messageBanner = this.querySelector('message-banner');

    if (!this.#tabSwitcher || !this.#blockList || !this.#jsonEditor || !this.#messageBanner) {
      console.warn('Admin editor: Not all child components found', {
        tabSwitcher: !!this.#tabSwitcher,
        blockList: !!this.#blockList,
        jsonEditor: !!this.#jsonEditor,
        messageBanner: !!this.#messageBanner
      });
    }
  }

  #loadInitialData() {
    // Rule 1 from javascript-pragmatic-rules: Handle promise rejections
    try {
      if (!this.#jsonEditor) {
        console.warn('JSON editor not found, cannot load initial data');
        return;
      }

      const initialValue = this.#jsonEditor.getAttribute('value');
      if (!initialValue) {
        console.log('No initial value in JSON editor');
        return;
      }

      const parsed = JSON.parse(initialValue);

      // Sync to block list
      if (this.#blockList) {
        this.#blockList.setBlocksData(parsed);
      } else {
        console.warn('Block list not found, cannot sync initial data');
      }
    } catch (error) {
      this.#showMessage('Failed to load initial data', 'error');
      console.error('Initial data load error:', error);
    }
  }

  #handleTabChanged(e) {
    const { activeTab, previousTab } = e.detail;

    // Sync data when switching tabs
    if (activeTab === 'json' && previousTab === 'list') {
      this.#syncListToJson();
    } else if (activeTab === 'list' && previousTab === 'json') {
      this.#syncJsonToList();
    }
  }

  #handleBlocksChanged(e) {
    // When blocks change in list view, sync to JSON
    this.#syncListToJson();
  }

  #handleJsonValid(e) {
    // JSON is valid, could sync to list if needed
    // For now, we only sync when explicitly switching tabs
  }

  #syncListToJson() {
    if (!this.#blockList || !this.#jsonEditor) return;

    const blocksData = this.#blockList.getBlocksData();
    this.#jsonEditor.setFormattedValue(blocksData);
  }

  #syncJsonToList() {
    if (!this.#jsonEditor || !this.#blockList) return;

    // Rule 1 from javascript-pragmatic-rules: Handle errors with context
    try {
      const parsed = this.#jsonEditor.getParsedValue();
      if (parsed) {
        this.#blockList.setBlocksData(parsed);
      }
    } catch (error) {
      this.#showMessage('Invalid JSON, cannot sync to list view', 'error');
      console.error('JSON sync error:', error);
    }
  }

  async #handleSubmit(e) {
    e.preventDefault();

    // Get active tab to determine which data to use
    const activeTab = this.#tabSwitcher?.getAttribute('active-tab') || 'list';

    // Sync data based on active tab
    if (activeTab === 'list') {
      this.#syncListToJson();
    } else {
      this.#syncJsonToList();
    }

    // Get JSON data
    if (!this.#jsonEditor) {
      this.#showMessage('Editor not initialized', 'error');
      return;
    }

    // Call getValue() method to get current editor content (not the initial attribute value)
    const jsonValue = this.#jsonEditor.getValue();

    // Validate JSON before submission
    // Rule 1 from javascript-pragmatic-rules: Handle errors with context
    try {
      JSON.parse(jsonValue);
    } catch (error) {
      this.#showMessage(`Invalid JSON: ${error.message}`, 'error');
      return;
    }

    // Submit to server
    await this.#submitToServer(jsonValue);
  }

  // Rule 2 from javascript-pragmatic-rules: Time-bound async operations
  async #submitToServer(jsonData) {
    // Cancel any previous request
    if (this.#abortController) {
      this.#abortController.abort();
    }

    this.#abortController = new AbortController();
    const timeoutId = setTimeout(() => this.#abortController.abort(), this.#timeout);

    // Rule 1 from javascript-pragmatic-rules: Handle promise rejections
    try {
      const response = await fetch(`/admin/api/${this.#routeName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonData,
        signal: this.#abortController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseText = await response.text();
      this.#showMessage(`✓ ${responseText}`, 'success');

      // Update local state to reflect saved state
      // Rule 1 from javascript-pragmatic-rules: Handle errors
      try {
        const parsed = JSON.parse(jsonData);
        if (this.#blockList) {
          this.#blockList.setBlocksData(parsed);
        }
      } catch (error) {
        console.error('Failed to update local state:', error);
      }

      // Principle 4: Events are the ONLY output from web-components-architecture
      this.dispatchEvent(new CustomEvent('save-success', {
        bubbles: true,
        composed: true,
        detail: {
          routeName: this.#routeName,
          data: jsonData
        }
      }));

    } catch (error) {
      clearTimeout(timeoutId);

      let errorMessage;

      // Rule 2 from javascript-pragmatic-rules: Handle timeout specifically
      if (error.name === 'AbortError') {
        errorMessage = `Request timed out after ${this.#timeout / 1_000} seconds`;
      } else if (error.message.startsWith('HTTP')) {
        errorMessage = `Failed to update: ${error.message}`;
      } else {
        errorMessage = `Network error: ${error.message}`;
      }

      this.#showMessage(errorMessage, 'error');

      // Principle 4: Events are the ONLY output from web-components-architecture
      this.dispatchEvent(new CustomEvent('save-error', {
        bubbles: true,
        composed: true,
        detail: {
          routeName: this.#routeName,
          error: error.message
        }
      }));

      // Rule 8 from javascript-pragmatic-rules: Global error handling
      console.error('Form submission error:', {
        routeName: this.#routeName,
        error: error.message,
        stack: error.stack
      });
    } finally {
      this.#abortController = null;
    }
  }

  #showMessage(text, type) {
    if (!this.#messageBanner) return;

    this.#messageBanner.showMessage(text, type);
  }
}

// Register the custom element
customElements.define('admin-editor', AdminEditor);

export { AdminEditor };
