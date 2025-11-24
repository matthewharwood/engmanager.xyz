// Admin Editor Components
// Entry point for all web components
// Using web-components-architecture and javascript-pragmatic-rules skills

// Import all components
import { MessageBanner } from './message-banner.js';
import { TabSwitcher } from './tab-switcher.js';
import { JsonEditor } from './json-editor.js';
import { BlockList } from './block-list.js';
import { AdminEditor } from './admin-editor.js';

// Rule 8 from javascript-pragmatic-rules: Global error handlers
window.addEventListener('error', (event) => {
  console.error('Global error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise
  });
  event.preventDefault();
});

// Export all components
export {
  MessageBanner,
  TabSwitcher,
  JsonEditor,
  BlockList,
  AdminEditor
};

// Log successful registration
console.log('Admin editor components registered:', {
  'message-banner': customElements.get('message-banner'),
  'tab-switcher': customElements.get('tab-switcher'),
  'json-editor': customElements.get('json-editor'),
  'block-list': customElements.get('block-list'),
  'admin-editor': customElements.get('admin-editor')
});
