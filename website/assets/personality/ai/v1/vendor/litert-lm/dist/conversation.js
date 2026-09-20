/**
 * Copyright 2026 The ODML Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const BUSY_MESSAGE = 'Conversation is busy. A generation is already in progress.';
/**
 * LiteRT-LM Conversation
 */
export class Conversation {
    conversation;
    engine;
    mutexes;
    isBusy = false;
    constructor(conversation, engine, mutexes) {
        this.conversation = conversation;
        this.engine = engine;
        this.mutexes = mutexes;
    }
    async sendMessage(message) {
        if (this.isBusy) {
            throw new Error(BUSY_MESSAGE);
        }
        this.isBusy = true;
        try {
            return await this.mutexes.executor.acquireAndRun(async () => {
                const currentMessageJson = messageToJsonString(message);
                const resultStr = await this.conversation.sendMessage(currentMessageJson);
                return JSON.parse(resultStr);
            });
        }
        finally {
            this.isBusy = false;
        }
    }
    /**
     * Sends a message to the LLM and returns a ReadableStream that yields
     * message chunks as they are generated.
     */
    sendMessageStreaming(message) {
        if (this.isBusy) {
            throw new Error(BUSY_MESSAGE);
        }
        this.isBusy = true;
        let isCancelled = false;
        let hasErrored = false;
        return new ReadableStream({
            start: (controller) => {
                const currentMessageJson = messageToJsonString(message);
                const executeGeneration = async () => {
                    await this.mutexes.executor.acquireAndRun(async () => {
                        await this.conversation.sendMessageAsync(currentMessageJson, (chunk, isDone, error) => {
                            if (isCancelled || hasErrored)
                                return;
                            if (error) {
                                hasErrored = true;
                                this.isBusy = false;
                                controller.error(new Error(error));
                                return;
                            }
                            if (chunk) {
                                try {
                                    const msg = JSON.parse(chunk);
                                    controller.enqueue(msg);
                                }
                                catch (e) {
                                    hasErrored = true;
                                    this.isBusy = false;
                                    controller.error(e);
                                }
                            }
                        });
                        // Since we're using the synchronus execution manager in C++, which
                        // lazily executes tasks, we must queue the message and call
                        // waitUntilDone to start the execution concurrently while holding
                        // the mutex lock.
                        await this.engine.waitUntilDone();
                    });
                    if (isCancelled || hasErrored)
                        return;
                    this.isBusy = false;
                    controller.close();
                };
                executeGeneration().catch((e) => {
                    if (isCancelled || hasErrored)
                        return;
                    this.isBusy = false;
                    controller.error(e);
                });
            },
            cancel: () => {
                isCancelled = true;
                this.isBusy = false;
                this.cancel();
            }
        });
    }
    /**
     * Sends a signal to cancel any current generation.
     */
    cancel() {
        this.conversation.cancelProcess();
    }
    async getHistory() {
        return this.mutexes.executor.acquireAndRun(() => {
            const historyStr = this.conversation.getHistory();
            return JSON.parse(historyStr);
        });
    }
    async getTokenCount() {
        return this.mutexes.executor.acquireAndRun(() => {
            return this.conversation.getTokenCount();
        });
    }
    async getBenchmarkInfo() {
        return this.mutexes.executor.acquireAndRun(() => {
            return this.conversation.getBenchmarkInfo();
        });
    }
    /**
     * Clones the conversation. The cloned conversation will be independent of the
     * original conversation, including the history, state, etc.
     */
    async clone() {
        if (this.isBusy) {
            throw new Error(BUSY_MESSAGE);
        }
        this.isBusy = true;
        try {
            return await this.mutexes.executor.acquireAndRun(() => {
                const wasmClonedConversation = this.conversation.clone();
                return new Conversation(wasmClonedConversation, this.engine, this.mutexes);
            });
        }
        finally {
            this.isBusy = false;
        }
    }
    async delete() {
        await this.mutexes.executor.acquireAndRun(() => {
            this.conversation.delete();
        });
    }
}
function messageToJsonString(messageLike) {
    let message;
    if (Array.isArray(messageLike)) {
        message = messageLike.map(toMessage);
    }
    else {
        message = toMessage(messageLike);
    }
    return JSON.stringify(message);
}
function toMessage(messageLike) {
    if (typeof messageLike === 'string') {
        return { role: 'user', content: messageLike };
    }
    return messageLike;
}
//# sourceMappingURL=conversation.js.map