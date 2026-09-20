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
 * Returns the string representation of the given url path.
 */
export function pathToString(path) {
    return path;
}
/**
 * Appends a path segment to the given url path.
 */
export function appendPathSegment(path, segment) {
    if (!path)
        return segment;
    if (!segment)
        return path;
    const pathWithSlash = path.endsWith('/') ? path : path + '/';
    const segmentWithoutSlash = segment.startsWith('/') ? segment.substring(1) : segment;
    return pathWithSlash + segmentWithoutSlash;
}
//# sourceMappingURL=url_path_utils.js.map