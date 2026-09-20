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
// Placeholder for internal dependency on trusted resource url
import { getGlobalLiteRtLm } from './global_litertlm.js';
/**
 * Set up the default WebGPU device for the LiteRT LM Wasm module.
 */
export async function setupDefaultWebGpuDevice() {
    await getGlobalLiteRtLm().setupDefaultWebGpuDevice();
}
/**
 * Run LiteRt LM models in the browser.
 */
export class LiteRtLm {
    liteRtLmWasm;
    static DEFAULT_WASM_PATH = new URL('../wasm/litertlm_wasm_compat_asyncify_internal.js', import.meta.url).href;
    constructor(wasmModule) {
        this.liteRtLmWasm = wasmModule;
        this.liteRtLmWasm.setupLogging();
    }
    async setupDefaultWebGpuDevice() {
        if (this.liteRtLmWasm.preinitializedWebGPUDevice) {
            return;
        }
        this.liteRtLmWasm.preinitializedWebGPUDevice =
            await createDefaultWebGpuDevice();
    }
    delete() {
        // no op for now.
    }
}
// TODO: b/475939320 - Use a shared implementation with LiteRT.
const DESIRED_WEBGPU_FEATURES = [
    'shader-f16',
    'subgroups',
];
async function createDefaultWebGpuDevice() {
    const adapterDescriptor = {
        powerPreference: 'high-performance',
    };
    const adapter = await navigator.gpu.requestAdapter(adapterDescriptor);
    if (!adapter) {
        throw new Error('No GPU adapter found.');
    }
    const requiredLimits = {
        maxBufferSize: adapter.limits.maxBufferSize,
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxStorageBuffersPerShaderStage: adapter.limits.maxStorageBuffersPerShaderStage,
        maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
    };
    const requiredFeatures = [];
    for (const feature of DESIRED_WEBGPU_FEATURES) {
        if (adapter.features.has(feature)) {
            requiredFeatures.push(feature);
        }
    }
    return await adapter.requestDevice({
        requiredFeatures,
        requiredLimits,
    });
}
//# sourceMappingURL=litertlm_web.js.map