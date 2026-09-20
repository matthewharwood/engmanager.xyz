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
 * Fills a WasmEmbeddingEngineSettings with the values from an EmbeddingEngineSettings.
 */
export function fillWasmEmbeddingEngineSettingsFromEmbeddingEngineSettings(wasmSettings, settings, backend) {
    const wasmExecutorSettings = wasmSettings.getMutableMainExecutorSettings();
    wasmExecutorSettings.setCacheDir(':nocache');
    if (settings.maxInputLength !== undefined) {
        wasmSettings.setMaxInputLength(settings.maxInputLength);
    }
    if (settings.visionTokensPerImage !== undefined) {
        wasmSettings.setVisionTokensPerImage(settings.visionTokensPerImage);
    }
    if (settings.mainExecutorSettings) {
        const mainExecutorSettings = settings.mainExecutorSettings;
        if (mainExecutorSettings.numThreads !== undefined) {
            wasmExecutorSettings.setNumThreads(mainExecutorSettings.numThreads);
        }
    }
}
//# sourceMappingURL=embedding_engine_settings.js.map