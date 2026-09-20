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
/**
 * Type guard to check if a tool is a WebMcpTool.
 */
export function isWebMcpTool(tool) {
    return 'inputSchema' in tool;
}
/**
 * Converts a WebMcpTool to a FunctionTool compatible with the C++ engine.
 */
export function toTool(tool) {
    const { inputSchema, execute, ...rest } = tool;
    return {
        type: 'function',
        function: { ...rest, parameters: inputSchema }
    };
}
//# sourceMappingURL=webmcp_tool.js.map