// Monaco JSON Editor Web Component
// JSON editing with Monaco Editor syntax highlighting
// Using javascript-pragmatic-rules skill for code quality
//
// This component provides a drop-in replacement for the textarea-based json-editor
// with the same API (getParsedValue, setFormattedValue) but adds:
// - Syntax highlighting for JSON
// - Line numbers
// - Better editing experience
// - Monaco Editor features (find/replace, etc.)

// Monaco Editor is loaded from CDN (monaco-editor-esm package)
// Import happens at top level - browser will cache it
let monacoPromise = null;

// Configure Monaco Environment for web workers
// This must be set before Monaco loads to avoid worker errors
// For monaco-editor-esm loaded from CDN, we use a simplified approach
// that avoids CORS issues by running language features in the main thread
window.MonacoEnvironment = {
    getWorkerUrl: function (moduleId, label) {
        // Return a blob URL that will load the worker from CDN
        // Using a proxy worker that imports from the CDN
        const workerPath = `https://cdn.jsdelivr.net/npm/monaco-editor-esm@0.17.0/esm/${moduleId}.js`;

        const workerCode = `
            import * as worker from '${workerPath}';
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        return URL.createObjectURL(blob);
    }
};

const loadMonaco = async () => {
    if (monacoPromise) return monacoPromise;

    monacoPromise = import('https://cdn.jsdelivr.net/npm/monaco-editor-esm@0.17.0/+esm')
        .then((module) => module.default || module)
        .catch((error) => {
            console.error('Failed to load Monaco Editor:', error);
            monacoPromise = null; // Reset on error to allow retry
            throw new Error('Monaco Editor failed to load from CDN', {cause: error});
        });

    return monacoPromise;
};

class MonacoJsonEditor extends HTMLElement {
    // Rule 17 from javascript-pragmatic-rules: ES Private Fields
    #editor = null;
    #monaco = null;
    #container = null;
    #changeListener = null;
    #validationTimeout = null;
    #validationDelay = 500; // Match old editor's debounce delay
    #isInitialized = false;

    connectedCallback() {
        // Set ARIA attributes for accessibility
        this.setAttribute('role', 'group');
        this.setAttribute('aria-label', 'Monaco JSON editor');

        this.#initializeEditor();
    }

    // Rule 4 from javascript-pragmatic-rules: Clean up resources
    disconnectedCallback() {
        // Clear validation timeout
        if (this.#validationTimeout) {
            clearTimeout(this.#validationTimeout);
            this.#validationTimeout = null;
        }

        // Dispose change listener
        if (this.#changeListener) {
            this.#changeListener.dispose();
            this.#changeListener = null;
        }

        // Dispose editor (critical for memory management)
        if (this.#editor) {
            this.#editor.dispose();
            this.#editor = null;
        }

        // Clear container
        this.#container = null;
        this.#monaco = null;
        this.#isInitialized = false;
    }

    // Rule 1 from javascript-pragmatic-rules: Handle promise rejections with async/await
    async #initializeEditor() {
        try {
            // 1. Create container div for Monaco
            this.#container = document.createElement('div');
            this.#container.style.width = '100%';
            this.#container.style.height = '400px';
            this.#container.style.border = '1px solid #333';
            this.#container.style.borderRadius = '4px';
            this.appendChild(this.#container);

            // 2. Load Monaco from CDN
            this.#monaco = await loadMonaco();

            // 3. Create editor instance
            this.#editor = this.#monaco.editor.create(this.#container, {
                value: this.getAttribute('value') || '{}',
                language: 'json',
                theme: 'vs-dark',
                automaticLayout: true, // Auto-resize with container
                minimap: {enabled: false}, // Disable minimap for simplicity
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                scrollBeyondLastLine: false,
                fontSize: 14,
                tabSize: 2,
                insertSpaces: true,
                wordWrap: 'on',
                wrappingIndent: 'indent',
                folding: true,
                foldingStrategy: 'indentation',
                showFoldingControls: 'always',
                // Accessibility
                'aria-label': 'JSON content editor'
            });

            // 4. Set up change listener
            // Rule 15 from javascript-pragmatic-rules: Debounce validation
            this.#changeListener = this.#editor.onDidChangeModelContent(() => {
                this.#handleContentChange();
            });

            this.#isInitialized = true;

            // 5. Initial validation
            this.#validateJson();

        } catch (error) {
            // Rule 1 from javascript-pragmatic-rules: Handle errors with context
            console.error('Failed to initialize Monaco Editor:', {
                error: error.message,
                cause: error.cause,
                stack: error.stack
            });

            // Show error message in UI
            this.#container.innerHTML = `
        <div style="padding: 1rem; color: #ef4444; background: #1a1a1a; border-radius: 4px;">
          <strong>Failed to load Monaco Editor</strong><br>
          ${error.message}<br>
          <small>Falling back to basic JSON editing</small>
        </div>
        <textarea
          style="width: 100%; min-height: 350px; margin-top: 1rem;
                 padding: 1rem; font-family: monospace; font-size: 14px;
                 background: #1a1a1a; color: #fff; border: 1px solid #333;
                 border-radius: 4px;"
          aria-label="JSON content (fallback editor)"
        >${this.getAttribute('value') || '{}'}</textarea>
      `;

            // Dispatch error event
            this.dispatchEvent(new CustomEvent('monaco-load-error', {
                bubbles: true,
                composed: true,
                detail: {error: error.message}
            }));
        }
    }

    #handleContentChange() {
        // Rule 15 from javascript-pragmatic-rules: Debounce validation
        if (this.#validationTimeout) {
            clearTimeout(this.#validationTimeout);
        }

        this.#validationTimeout = setTimeout(() => {
            this.#validateJson();
            this.#validationTimeout = null;
        }, this.#validationDelay);

        // Emit immediate content-changed event (not debounced)
        const value = this.getValue();
        this.dispatchEvent(new CustomEvent('content-changed', {
            bubbles: true,
            composed: true,
            detail: {
                value,
                isValid: this.#isValidJson(value)
            }
        }));
    }

    #isValidJson(value) {
        try {
            JSON.parse(value);
            return true;
        } catch {
            return false;
        }
    }

    #validateJson() {
        if (!this.#editor) return;

        const value = this.getValue();

        // Rule 1 from javascript-pragmatic-rules: Handle errors with context
        try {
            const parsed = JSON.parse(value);

            // Valid JSON - emit event
            this.dispatchEvent(new CustomEvent('json-valid', {
                bubbles: true,
                composed: true,
                detail: {
                    value,
                    parsed
                }
            }));

        } catch (error) {
            // Invalid JSON - emit event
            this.dispatchEvent(new CustomEvent('json-invalid', {
                bubbles: true,
                composed: true,
                detail: {
                    value,
                    error: error.message
                }
            }));
        }
    }

    // Public API: Get current JSON string
    getValue() {
        if (!this.#editor || !this.#isInitialized) {
            // Fallback to textarea if Monaco failed to load
            const textarea = this.querySelector('textarea');
            return textarea ? textarea.value : (this.getAttribute('value') || '');
        }
        return this.#editor.getValue();
    }

    // Public API: Set JSON content
    setValue(jsonString) {
        if (!this.#editor || !this.#isInitialized) {
            // Fallback to textarea if Monaco failed to load
            const textarea = this.querySelector('textarea');
            if (textarea) textarea.value = jsonString;
            return;
        }
        this.#editor.setValue(jsonString);
    }

    // Public API: Get parsed JSON object (null if invalid)
    // Matches old json-editor API for compatibility
    getParsedValue() {
        try {
            return JSON.parse(this.getValue());
        } catch (error) {
            return null;
        }
    }

    // Public API: Set formatted JSON from object
    // Matches old json-editor API for compatibility
    setFormattedValue(obj) {
        try {
            const formatted = JSON.stringify(obj, null, 2);
            this.setValue(formatted);
        } catch (error) {
            // Rule 1 from javascript-pragmatic-rules: Handle errors with context
            console.error('Failed to format JSON:', {
                error: error.message,
                object: obj
            });

            this.dispatchEvent(new CustomEvent('json-format-error', {
                bubbles: true,
                composed: true,
                detail: {error: error.message}
            }));
        }
    }

    // Public API: Focus the editor
    focus() {
        if (this.#editor && this.#isInitialized) {
            this.#editor.focus();
        } else {
            // Fallback to textarea
            const textarea = this.querySelector('textarea');
            if (textarea) textarea.focus();
        }
    }

    // Public API: Format current JSON content using Monaco's formatter
    async format() {
        if (!this.#editor || !this.#isInitialized) return;

        try {
            const action = this.#editor.getAction('editor.action.formatDocument');
            if (action) {
                await action.run();
            }
        } catch (error) {
            console.error('Failed to format document:', error);
        }
    }
}

// Register the custom element
customElements.define('monaco-json-editor', MonacoJsonEditor);

export {MonacoJsonEditor};
