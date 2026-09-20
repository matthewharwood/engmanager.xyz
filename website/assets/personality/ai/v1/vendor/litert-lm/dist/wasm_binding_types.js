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
/**
 * Backend types for LiteRT-LM.
 */
export const Backend = {
    // Ideally, we'd pull these from the Wasm module, but we want them to be
    // available in JS before the Wasm module is loaded.
    UNSPECIFIED: 0,
    CPU_ARTISAN: 1,
    GPU_ARTISAN: 2,
    CPU: 3,
    GPU: 4,
    GOOGLE_TENSOR_ARTISAN: 5,
    NPU: 6,
};
/**
 * LiteRT-LM SamplerType enum values
 */
export const SamplerType = {
    TYPE_UNSPECIFIED: 0,
    TOP_K: 1,
    TOP_P: 2,
    GREEDY: 3,
};
/**
 * Input overflow strategies for embedding computations.
 */
export const InputOverflowStrategy = {
    CHUNK_AND_AVERAGE: 0,
    TRUNCATE: 1,
    ERROR: 2,
};
//# sourceMappingURL=wasm_binding_types.js.map