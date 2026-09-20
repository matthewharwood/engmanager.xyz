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
import { createWasmLib } from '../../wasm-utils/index.js';
import { LiteRtLm } from './litertlm_web.js';
import { appendPathSegment, pathToString } from './url_path_utils.js';
import { supportsFeature } from './wasm_feature_detect.js';
const WASM_JS_FILE_NAME = 'litertlm_wasm_internal.js';
const WASM_JS_COMPAT_FILE_NAME = 'litertlm_wasm_compat_internal.js';
const WASM_JS_ASYNCIFY_FILE_NAME = 'litertlm_wasm_asyncify_internal.js';
const WASM_JS_COMPAT_ASYNCIFY_FILE_NAME = 'litertlm_wasm_compat_asyncify_internal.js';
/**
 * Load the LiteRtLm library with WASM from the given URL. Does not set the
 * global LiteRtLm instance.
 */
export async function load(path, options) {
    const pathString = pathToString(path);
    const relaxedSimd = await supportsFeature('relaxedSimd');
    const jspi = await supportsFeature('jspi');
    let fileName = '';
    if (relaxedSimd) {
        fileName = jspi ? WASM_JS_FILE_NAME : WASM_JS_ASYNCIFY_FILE_NAME;
    }
    else {
        fileName =
            jspi ? WASM_JS_COMPAT_FILE_NAME : WASM_JS_COMPAT_ASYNCIFY_FILE_NAME;
    }
    let jsFilePath = path;
    if (pathString.endsWith('.wasm')) {
        throw new Error('Please load the `.js` file corresponding to the `.wasm` file, or ' +
            'load the directory containing it.');
    }
    else if (!pathString.endsWith('.js')) {
        jsFilePath = appendPathSegment(path, fileName);
    }
    return createWasmLib(LiteRtLm, jsFilePath);
}
//# sourceMappingURL=load.js.map