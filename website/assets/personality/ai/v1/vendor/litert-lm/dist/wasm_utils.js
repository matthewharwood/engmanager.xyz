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
 * Convert an EmscriptenVector to a native array and delete the vector
 *
 * Deletes the EmscriptenVector when done. The caller must still delete the
 * individual elements of the returned array.
 */
export function consumeEmscriptenVectorToArray(vector) {
    const array = new Array(vector.size());
    for (let i = 0; i < vector.size(); ++i) {
        array[i] = vector.get(i);
    }
    vector.delete();
    return array;
}
/**
 * Fill an EmscriptenVector from an Iterable.
 *
 * The EmscriptenVector must be large enough to hold the data.
 */
export function fillEmscriptenVector(data, vector) {
    // Embind lacks vector.reserve().
    for (const item of data) {
        vector.push_back(item);
    }
}
//# sourceMappingURL=wasm_utils.js.map