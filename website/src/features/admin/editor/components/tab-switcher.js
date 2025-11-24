// Tab Switcher Web Component
// Manages tab navigation with attribute-driven state
// Using web-components-architecture and javascript-pragmatic-rules skills

// Using attribute-driven state pattern from web-components-architecture
class TabSwitcher extends HTMLElement {
  // Principle 2: Attribute-Driven State from web-components-architecture
  static get observedAttributes() {
    return ['active-tab'];
  }

  // Lifecycle callback from web-components-architecture
  connectedCallback() {
    // Using handleEvent pattern from web-components-architecture
    this.addEventListener('click', this);

    // Set ARIA role for accessibility
    this.setAttribute('role', 'tablist');

    // Initialize active tab if not set
    if (!this.hasAttribute('active-tab')) {
      this.setAttribute('active-tab', 'list');
    }

    this.render();
  }

  // Rule 4 from javascript-pragmatic-rules: Clean up resources
  disconnectedCallback() {
    this.removeEventListener('click', this);
  }

  // Principle 2: React to attribute changes from web-components-architecture
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'active-tab') {
      this.updateActiveTab(newValue);

      // Principle 4: Events are the ONLY output from web-components-architecture
      this.dispatchEvent(new CustomEvent('tab-changed', {
        bubbles: true,
        composed: true,
        detail: {
          activeTab: newValue,
          previousTab: oldValue
        }
      }));
    }
  }

  // Principle 3: HandleEvent pattern from web-components-architecture
  handleEvent(e) {
    switch (e.type) {
      case 'click':
        this.#handleClick(e);
        break;
    }
  }

  #handleClick(e) {
    // Principle 1: Zero DOM Selection - use event delegation from web-components-architecture
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;

    const targetTab = tab.getAttribute('data-tab');
    if (targetTab && targetTab !== this.getAttribute('active-tab')) {
      this.setAttribute('active-tab', targetTab);
    }
  }

  updateActiveTab(activeTab) {
    // Principle 1: Zero DOM Selection - use direct element references from web-components-architecture
    // Get all direct children that are tab elements
    const tabs = Array.from(this.children).filter(child => child.hasAttribute('data-tab'));

    for (const tab of tabs) {
      const tabName = tab.getAttribute('data-tab');
      const isActive = tabName === activeTab;

      // Update ARIA attributes
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(isActive));
      tab.setAttribute('tabindex', isActive ? '0' : '-1');

      // Update visual state via class
      if (isActive) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    }

    // Update corresponding tab panels
    // Find parent admin-editor and update panels within it
    const adminEditor = this.closest('admin-editor');
    if (adminEditor) {
      const listView = adminEditor.querySelector('#list-view');
      const jsonView = adminEditor.querySelector('#json-view');

      if (listView && jsonView) {
        if (activeTab === 'list') {
          listView.classList.add('active');
          jsonView.classList.remove('active');
        } else if (activeTab === 'json') {
          listView.classList.remove('active');
          jsonView.classList.add('active');
        }
      }
    }
  }

  render() {
    const activeTab = this.getAttribute('active-tab');
    this.updateActiveTab(activeTab);
  }
}

// Register the custom element
customElements.define('tab-switcher', TabSwitcher);

export { TabSwitcher };
