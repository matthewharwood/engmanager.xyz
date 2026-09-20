/**
 * Copyright 2026 Google LLC
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
/** Fake implementation of Conversation for testing. */
export class ConversationFake {
    initialHistory;
    history = [];
    nextResponses = [];
    constructor(initialHistory = []) {
        this.initialHistory = initialHistory;
        this.history = [...initialHistory];
    }
    /**
     * Enqueues a message that the fake will return on the next call to
     * sendMessage or sendMessageStreaming. Can be called multiple times.
     */
    queueResponse(message) {
        this.nextResponses.push(message);
    }
    popNextResponse() {
        if (this.nextResponses.length > 0) {
            return this.nextResponses.shift();
        }
        return { role: 'assistant', content: 'hello from fake' };
    }
    appendInput(message) {
        if (Array.isArray(message)) {
            this.history.push(...message.map(m => typeof m === 'string' ? { role: 'user', content: m } :
                m));
        }
        else {
            this.history.push(typeof message === 'string' ?
                { role: 'user', content: message } :
                message);
        }
    }
    async sendMessage(message) {
        this.appendInput(message);
        const newMessage = this.popNextResponse();
        this.history.push(newMessage);
        return newMessage;
    }
    sendMessageStreaming(message) {
        this.appendInput(message);
        return new ReadableStream({
            start: (controller) => {
                const newMessage = this.popNextResponse();
                this.history.push(newMessage);
                controller.enqueue(newMessage);
                controller.close();
            }
        });
    }
    getHistory() {
        return [...this.history];
    }
    cancel() { }
    async delete() { }
    async getTokenCount() {
        return this.history.length * 10;
    }
    async getBenchmarkInfo() {
        return {
            lastPrefillTokensPerSecond: 0,
            lastPrefillTokenCount: 0,
            lastDecodeTokensPerSecond: 0,
            lastDecodeTokenCount: 0,
            timeToFirstTokenInSecond: 0,
        };
    }
    clone() {
        const cloned = new ConversationFake([...this.history]);
        cloned.nextResponses = [...this.nextResponses];
        return cloned;
    }
}
/** Fake implementation of Session for testing. */
export class SessionFake {
    inputsPrefilled = [];
    async runPrefill(inputs) {
        this.inputsPrefilled.push(...inputs);
    }
    async runDecode() {
        return { getTexts: () => ['decoded response'], delete: () => { } };
    }
    cancel() { }
    clone() {
        const cloned = new SessionFake();
        cloned.inputsPrefilled = [...this.inputsPrefilled];
        return cloned;
    }
    async delete() { }
}
/** Fake implementation of Engine for testing. */
export class EngineFake {
    settings;
    cachedSession = new SessionFake();
    cachedConversation = new ConversationFake();
    constructor(settings) {
        this.settings = settings;
    }
    static async create(engineSettings, inputPromptAsHint = '') {
        return new EngineFake(engineSettings);
    }
    async createSession(sessionConfig = {}) {
        return this.cachedSession;
    }
    async createConversation(config) {
        return this.cachedConversation;
    }
    async delete() { }
}
//# sourceMappingURL=fakes.js.map