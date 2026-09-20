/**
 * Copyright 2025 Google LLC
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
/**
 * An error thrown when LiteRT-LM is not loaded.
 */
export class LiteRtLmNotLoadedError extends Error {
    constructor() {
        super('LiteRT-LM is not initialized yet. Please call loadLiteRtLm() and wait for its ' +
            'promise to resolve to load the LiteRT-LM WASM module.');
    }
}
let globalLiteRtLm = undefined;
let globalLiteRtLmPromise = undefined;
/**
 * Get the global LiteRT-LM instance.
 *
 * In most cases, you can call the functions exported by this module that wrap
 * the global LiteRT-LM instance instead.
 */
export function getGlobalLiteRtLm() {
    if (!globalLiteRtLm) {
        throw new LiteRtLmNotLoadedError();
    }
    return globalLiteRtLm;
}
/**
 * Check if the global LiteRT-LM instance is defined.
 *
 * Only exposed internally.
 */
export function hasGlobalLiteRtLm() {
    return Boolean(globalLiteRtLm);
}
/**
 * Set the global LiteRT-LM instance.
 *
 * Only exposed internally.
 */
export function setGlobalLiteRtLm(LiteRtLm) {
    globalLiteRtLm = LiteRtLm;
}
/**
 * Resolves when the currently loading / loaded LiteRT-LM instance is loaded.
 *
 * If `loadLiteRtLm()` has been called, this function returns a promise that
 * resolves when the LiteRT-LM instance is loaded. Otherwise, it returns
 * undefined.
 *
 * If LiteRT-LM has failed to load before this function is called or has been
 * manually unloaded with `unloadLiteRtLm()`, this function also returns
 * undefined.
 */
export function getGlobalLiteRtLmPromise() {
    return globalLiteRtLmPromise;
}
/**
 * Check if the global LiteRT-LM instance promise is defined.
 *
 * Only exposed internally.
 */
export function hasGlobalLiteRtLmPromise() {
    return Boolean(globalLiteRtLmPromise);
}
/**
 * Set the global LiteRT-LM instance promise.
 *
 * Only exposed internally.
 */
export function setGlobalLiteRtLmPromise(promise) {
    globalLiteRtLmPromise = promise;
}
//# sourceMappingURL=global_litertlm.js.map