/* Classic dedicated worker: LiteRT-LM's upstream loader uses importScripts. */
let engine = null;
let conversation = null;
let operation = false;
const base = new URL('./', self.location.href);
function reply(id, type, data) {self.postMessage({id, type, ...data});}
self.onmessage = async ({data}) => {
  const {id, type} = data || {};
  if (!Number.isSafeInteger(id)) return;
  if (type === 'cancel') {conversation?.cancel(); return;}
  if (operation) {reply(id, 'error', {message: 'Local AI is already busy.'}); return;}
  operation = true;
  try {
    if (type === 'load') {
      if (!(data.model instanceof Blob)) throw new Error('A verified local model is required.');
      const [{loadLiteRtLm}, {Engine}] = await Promise.all([
        import('./vendor/litert-lm/dist/load_litertlm.js'), import('./vendor/litert-lm/dist/engine.js'),
      ]);
      // Explicit paths prevent the upstream default CDN and worker-relative lookup.
      self.Module = {locateFile: name => new URL('vendor/litert-lm/wasm/' + name, base).href};
      await loadLiteRtLm(new URL('vendor/litert-lm/wasm/litertlm_wasm_compat_asyncify_internal.js', base).href);
      engine = await Engine.create({model: data.model, mainExecutorSettings: {maxNumTokens: 8192}});
      reply(id, 'done', {result: {ready: true}});
    } else if (type === 'generate') {
      if (!engine) throw new Error('Load the local model first.');
      conversation = await engine.createConversation({
        preface: {messages: [{role: 'system', content: data.system}], extra_context: {enable_thinking: false}},
        sessionConfig: {maxOutputTokens: 1536, samplerParams: {temperature: 0.2, seed: 67}},
      });
      let text = '';
      for await (const chunk of conversation.sendMessageStreaming({role: 'user', content: data.prompt})) {
        if (chunk.tool_calls?.length) throw new Error('Tool calls are not supported in a local reflection.');
        for (const item of chunk.content || []) {
          if (item.type !== 'text') continue;
          if (typeof item.text !== 'string' || text.length + item.text.length > 6000) throw new Error('Local AI output exceeded its size limit.');
          text += item.text;
          reply(id, 'chunk', {text: item.text});
        }
      }
      await conversation.delete();
      conversation = null;
      reply(id, 'done', {result: {text}});
    } else if (type === 'unload') {
      if (conversation) await conversation.delete();
      conversation = null;
      if (engine) await engine.delete();
      engine = null;
      reply(id, 'done', {result: {ready: false}});
    } else throw new Error('Unknown local AI operation.');
  } catch (error) {
    reply(id, 'error', {message: error instanceof Error ? error.message.slice(0, 400) : 'Local AI could not complete this request.'});
  } finally {
    if (type === 'generate' && conversation) {try {await conversation.delete();} catch {} conversation = null;}
    operation = false;
  }
};
