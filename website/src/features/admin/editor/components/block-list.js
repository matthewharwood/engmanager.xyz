// Block List Web Component
// Displays and manages list of content blocks
// Using web-components-architecture and javascript-pragmatic-rules skills

// Using attribute-driven state pattern from web-components-architecture
class BlockList extends HTMLElement {
  #blocksData = { blocks: [] };
  #listContainer = null;
  #blockTypeSelect = null;

  // Block type templates
  #blockDefaults = {
    Header: {
      id: '',
      type: 'Header',
      props: {
        headline: '',
        button: {
          href: '',
          text: '',
          aria_label: ''
        }
      }
    },
    Hero: {
      id: '',
      type: 'Hero',
      props: {
        headline: '',
        subheadline: ''
      }
    }
  };

  // Principle 2: Attribute-Driven State from web-components-architecture
  static get observedAttributes() {
    return ['blocks'];
  }

  // Lifecycle callback from web-components-architecture
  connectedCallback() {
    // Using handleEvent pattern from web-components-architecture
    this.addEventListener('click', this);

    // Set ARIA attributes for accessibility
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Content blocks list');

    this.render();
  }

  // Rule 4 from javascript-pragmatic-rules: Clean up resources
  disconnectedCallback() {
    this.removeEventListener('click', this);
  }

  // Principle 2: React to attribute changes from web-components-architecture
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'blocks') {
      this.#loadBlocksFromAttribute(newValue);
      this.#renderBlocks();
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
    const deleteBtn = e.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      const index = parseInt(deleteBtn.getAttribute('data-index'), 10);
      if (!isNaN(index)) {
        this.#deleteBlock(index);
      }
      return;
    }

    const addBtn = e.target.closest('[data-action="add"]');
    if (addBtn) {
      const blockType = this.#getSelectedBlockType();
      if (blockType) {
        this.#addBlock(blockType);
      }
      return;
    }
  }

  #loadBlocksFromAttribute(jsonString) {
    if (!jsonString) {
      this.#blocksData = { blocks: [] };
      return;
    }

    // Rule 1 from javascript-pragmatic-rules: Handle errors with context
    try {
      const parsed = JSON.parse(jsonString);
      this.#blocksData = parsed;
    } catch (error) {
      console.error('Failed to parse blocks JSON:', error);

      // Principle 4: Events are the ONLY output from web-components-architecture
      this.dispatchEvent(new CustomEvent('blocks-error', {
        bubbles: true,
        composed: true,
        detail: {
          error: 'Failed to parse blocks data',
          cause: error.message
        }
      }));

      this.#blocksData = { blocks: [] };
    }
  }

  #getSelectedBlockType() {
    // Principle 1: Zero DOM Selection - use stored reference from web-components-architecture
    if (!this.#blockTypeSelect) return null;
    return this.#blockTypeSelect.value;
  }

  #addBlock(blockType) {
    if (!this.#blockDefaults[blockType]) {
      console.error(`Unknown block type: ${blockType}`);
      return;
    }

    // Rule 5 from javascript-pragmatic-rules: Prefer immutability
    const newBlock = JSON.parse(JSON.stringify(this.#blockDefaults[blockType]));
    this.#blocksData.blocks.push(newBlock);

    this.#updateBlocksAttribute();
    this.#renderBlocks();

    // Principle 4: Events are the ONLY output from web-components-architecture
    this.dispatchEvent(new CustomEvent('blocks-changed', {
      bubbles: true,
      composed: true,
      detail: {
        action: 'add',
        blockType,
        blocks: this.#blocksData
      }
    }));
  }

  #deleteBlock(index) {
    if (index < 0 || index >= this.#blocksData.blocks.length) {
      console.error(`Invalid block index: ${index}`);
      return;
    }

    const deletedBlock = this.#blocksData.blocks[index];
    this.#blocksData.blocks.splice(index, 1);

    this.#updateBlocksAttribute();
    this.#renderBlocks();

    // Principle 4: Events are the ONLY output from web-components-architecture
    this.dispatchEvent(new CustomEvent('blocks-changed', {
      bubbles: true,
      composed: true,
      detail: {
        action: 'delete',
        index,
        deletedBlock,
        blocks: this.#blocksData
      }
    }));
  }

  #updateBlocksAttribute() {
    const jsonString = JSON.stringify(this.#blocksData);
    this.setAttribute('blocks', jsonString);
  }

  // Public API: Get blocks data
  getBlocksData() {
    return this.#blocksData;
  }

  // Public API: Set blocks data
  setBlocksData(blocksData) {
    this.#blocksData = blocksData;
    this.#updateBlocksAttribute();
    this.#renderBlocks();
  }

  render() {
    // Principle 1: Zero DOM Selection from web-components-architecture
    // Create elements directly without querySelector

    const container = document.createElement('div');
    container.className = 'block-list-container';

    // Create controls section
    const controls = document.createElement('div');
    controls.className = 'block-list-controls';

    // Principle 1: Zero DOM Selection - store direct reference from web-components-architecture
    this.#blockTypeSelect = document.createElement('select');
    this.#blockTypeSelect.className = 'block-type-select';
    this.#blockTypeSelect.setAttribute('data-block-type-select', '');
    this.#blockTypeSelect.setAttribute('aria-label', 'Select block type to add');

    // Add options for each block type
    for (const blockType of Object.keys(this.#blockDefaults)) {
      const option = document.createElement('option');
      option.value = blockType;
      option.textContent = blockType;
      this.#blockTypeSelect.appendChild(option);
    }

    const addButton = document.createElement('button');
    addButton.className = 'btn-add';
    addButton.setAttribute('type', 'button');
    addButton.setAttribute('data-action', 'add');
    addButton.textContent = 'Add Block';

    controls.appendChild(this.#blockTypeSelect);
    controls.appendChild(addButton);

    // Create list container
    this.#listContainer = document.createElement('ul');
    this.#listContainer.className = 'block-list';
    this.#listContainer.setAttribute('role', 'list');

    container.appendChild(controls);
    container.appendChild(this.#listContainer);

    // Clear and replace content
    this.textContent = '';
    this.appendChild(container);

    // Render blocks
    this.#renderBlocks();
  }

  #renderBlocks() {
    if (!this.#listContainer) return;

    // Clear existing blocks
    this.#listContainer.textContent = '';

    const blocks = this.#blocksData.blocks || [];

    if (blocks.length === 0) {
      const emptyMessage = document.createElement('li');
      emptyMessage.className = 'block-list-empty';
      emptyMessage.textContent = 'No blocks added yet. Add a block to get started.';
      this.#listContainer.appendChild(emptyMessage);
      return;
    }

    // Render each block
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const listItem = this.#createBlockItem(block, i);
      this.#listContainer.appendChild(listItem);
    }
  }

  #createBlockItem(block, index) {
    const li = document.createElement('li');
    li.className = 'block-item';
    li.setAttribute('role', 'listitem');

    const info = document.createElement('div');
    info.className = 'block-info';

    const type = document.createElement('div');
    type.className = 'block-type';
    type.textContent = block.type;

    const props = document.createElement('div');
    props.className = 'block-props';
    props.textContent = JSON.stringify(block.props, null, 2);

    info.appendChild(type);
    info.appendChild(props);

    const actions = document.createElement('div');
    actions.className = 'block-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('type', 'button');
    deleteBtn.setAttribute('data-action', 'delete');
    deleteBtn.setAttribute('data-index', String(index));
    deleteBtn.setAttribute('aria-label', `Delete ${block.type} block`);

    actions.appendChild(deleteBtn);

    li.appendChild(info);
    li.appendChild(actions);

    return li;
  }
}

// Register the custom element
customElements.define('block-list', BlockList);

export { BlockList };
