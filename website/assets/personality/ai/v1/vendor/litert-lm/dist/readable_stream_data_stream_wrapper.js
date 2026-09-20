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
class Slice {
    size;
    data;
    fullyDiscarded = false;
    discardedRegions = [];
    constructor(size) {
        this.size = size;
    }
    discard(start, end) {
        if (this.fullyDiscarded)
            return;
        if (this.discardedRegions.length === 0) {
            // No discarded regions yet, so add this one.
            this.discardedRegions.push([start, end]);
            this.checkFullyDiscarded();
            return;
        }
        this.discardedRegions.push([start, end]);
        this.discardedRegions.sort((a, b) => a[0] - b[0]);
        // Merge overlapping regions.
        const mergedRegions = [];
        for (const region of this.discardedRegions) {
            const lastRegion = mergedRegions[mergedRegions.length - 1];
            if (!lastRegion || lastRegion[1] < region[0]) {
                mergedRegions.push(region);
            }
            else {
                lastRegion[1] = Math.max(lastRegion[1], region[1]);
            }
        }
        this.discardedRegions = mergedRegions;
        this.checkFullyDiscarded();
    }
    getDiscardedRegions(start = 0, end = this.size) {
        const result = [];
        for (const [rStart, rEnd] of this.discardedRegions) {
            // If the region starts after the end of the requested range,
            // no further regions will overlap.
            if (rStart >= end) {
                break;
            }
            // If the region ends before or at the start of the requested range, skip
            // it.
            if (rEnd <= start) {
                continue;
            }
            result.push([rStart, rEnd]);
        }
        return result;
    }
    checkFullyDiscarded() {
        if (this.discardedRegions.length === 1 &&
            this.discardedRegions[0][0] === 0 &&
            this.discardedRegions[0][1] === this.size) {
            this.fullyDiscarded = true;
            this.data = undefined;
        }
    }
}
/**
 * Wraps a ReadableStream for use in LiteRT LM C++ streamed model loading.
 */
export class ReadableStreamDataStreamWrapper {
    stream;
    getWasmHeap;
    bytesPerSlice;
    slices = [];
    streamDone = false;
    globalPosition = 0;
    reader;
    leftoverData;
    isReading = false;
    constructor(stream, 
    // Heap is detached whenever it's resized, so we get it each time.
    getWasmHeap, bytesPerSlice = 10_000_000) {
        this.stream = stream;
        this.getWasmHeap = getWasmHeap;
        this.bytesPerSlice = bytesPerSlice;
        try {
            this.reader = { byobReader: this.stream.getReader({ mode: 'byob' }) };
        }
        catch (e) {
            this.reader = { defaultReader: this.stream.getReader() };
        }
    }
    *getViews(start, end) {
        if (start >= end) {
            return;
        }
        // A scratch buffer for creating new slices if needed.
        // If the slice is fully discarded, we'll reuse this buffer instead of
        // creating a new one.
        let scratchBuffer;
        let previousSlice;
        let position = start;
        while (position < end) {
            const sliceIndex = Math.floor(position / this.bytesPerSlice);
            const slicePosition = position % this.bytesPerSlice;
            const sliceStartGlobalPosition = sliceIndex * this.bytesPerSlice;
            let slice = this.slices[sliceIndex];
            if (!slice) {
                if (!previousSlice || !previousSlice.fullyDiscarded) {
                    // Make a new scratch buffer since the old one was assigned to the
                    // previous slice (or there is no previous slice).
                    scratchBuffer = new Uint8Array(this.bytesPerSlice);
                }
                slice = new Slice(this.bytesPerSlice);
                slice.data = scratchBuffer;
                this.slices[sliceIndex] = slice;
            }
            const viewEnd = Math.min(this.bytesPerSlice, end - sliceStartGlobalPosition);
            const discardView = () => {
                slice.discard(slicePosition, viewEnd);
            };
            const viewLength = viewEnd - slicePosition;
            const setView = (view) => {
                // Necessary when a BYOB reader invalidates the buffer.
                slice.data = new Uint8Array(view.buffer, 0, view.buffer.byteLength);
                scratchBuffer = slice.data;
            };
            const checkReadable = () => {
                const discardedRegions = slice.getDiscardedRegions(slicePosition, viewEnd);
                if (discardedRegions.length > 0) {
                    const globalDiscardedRegions = discardedRegions.map(([start, end]) => `[${start + sliceStartGlobalPosition}, ${end + sliceStartGlobalPosition}]`);
                    throw new Error(`Slice ${sliceIndex} for data at ${position} overlaps discarded regions: [${globalDiscardedRegions.join(', ')}]`);
                }
                if (!slice.data) {
                    throw new Error(`No ArrayBuffer for slice ${sliceIndex} at position ${position}`);
                }
            };
            const getView = () => {
                checkReadable();
                return new Uint8Array(slice.data.buffer, slice.data.byteOffset + slicePosition, slice.data.byteOffset + viewLength);
            };
            yield {
                getView,
                discardView,
                setView,
                checkReadable,
            };
            previousSlice = slice;
            position += viewLength;
        }
    }
    async readInternal(destAddress, offset, count, discard) {
        if (this.isReading) {
            throw new Error('Concurrent reads are not supported');
        }
        this.isReading = true;
        try {
            // 1. Read and cache all unfetched data before the requested region.
            for (const { getView, setView, checkReadable } of this.getViews(this.globalPosition, offset)) {
                checkReadable();
                // We do not discard or change destAddress here as this is before the
                // requested region.
                const newView = await this.fillBufferFromStream(getView());
                setView(newView);
                if (newView.length === 0) {
                    break; // Hit EOF early
                }
            }
            // 2. Copy cached data from existing slices. This may be a no-op if none
            // of the requested region is cached.
            const endOfCachedRead = Math.min(this.globalPosition, offset + count);
            for (const { getView, discardView } of this.getViews(offset, endOfCachedRead)) {
                const view = getView();
                this.getWasmHeap().set(view, destAddress);
                if (discard)
                    discardView();
                destAddress += view.length;
            }
            // 3. Read and optionally cache remaining unfetched data and copy it to
            // the destination.
            const startOfUncachedRead = Math.max(endOfCachedRead, offset);
            for (const { getView, setView, discardView } of this.getViews(startOfUncachedRead, offset + count)) {
                // If we are already at EOF (e.g. from step 1 or a previous iteration
                // here), stop reading
                if (this.streamDone && this.globalPosition <= startOfUncachedRead)
                    break;
                const newView = await this.fillBufferFromStream(getView());
                setView(newView);
                this.getWasmHeap().set(newView, destAddress);
                if (discard)
                    discardView();
                destAddress += newView.length;
            }
        }
        finally {
            this.isReading = false;
        }
    }
    async fillBufferFromStream(buffer) {
        // Must read byteLength now as buffer will be invalidated.
        const byteLength = buffer.byteLength;
        if (byteLength === 0) {
            return buffer;
        }
        const byteOffset = buffer.byteOffset;
        let bytesRead = 0;
        let arrayBuffer = buffer.buffer;
        while (bytesRead < byteLength) {
            if (this.streamDone &&
                (!this.leftoverData || this.leftoverData.length === 0)) {
                throw new Error(`Read from stream returned early EOF at position ${this.globalPosition}. Expected ${byteLength - bytesRead} more bytes.`);
            }
            if (this.reader.byobReader) {
                // Create a view of the remaining region to be written to. We have to
                // do this each time since the BYOB reader will detach the view and
                // its underlying ArrayBuffer.
                const view = new Uint8Array(arrayBuffer, byteOffset + bytesRead, byteLength - bytesRead);
                const result = await this.reader.byobReader.read(view);
                if (result.done) {
                    this.streamDone = true;
                }
                if (!result.value) {
                    throw new Error('Read from stream returned null value');
                }
                this.globalPosition += result.value.byteLength;
                bytesRead += result.value.byteLength;
                arrayBuffer = result.value.buffer;
            }
            else {
                let chunk;
                if (this.leftoverData && this.leftoverData.length > 0) {
                    chunk = this.leftoverData;
                    this.leftoverData = undefined;
                }
                else {
                    const result = await this.reader.defaultReader.read();
                    if (result.done) {
                        this.streamDone = true;
                        if (!result.value) {
                            continue;
                        }
                    }
                    if (!result.value) {
                        throw new Error('Read from stream returned null value');
                    }
                    chunk = result.value;
                }
                const bytesNeeded = byteLength - bytesRead;
                const bytesToCopy = Math.min(chunk.length, bytesNeeded);
                const destView = new Uint8Array(arrayBuffer, byteOffset + bytesRead, bytesToCopy);
                destView.set(chunk.subarray(0, bytesToCopy));
                if (chunk.length > bytesToCopy) {
                    this.leftoverData = chunk.subarray(bytesToCopy);
                }
                this.globalPosition += bytesToCopy;
                bytesRead += bytesToCopy;
            }
        }
        const result = new Uint8Array(arrayBuffer, byteOffset, bytesRead);
        if (result.length !== byteLength) {
            throw new Error(`Read from stream returned ${result.length} bytes, expected ${byteLength}`);
        }
        return result;
    }
    doDiscard(offset, count) {
        for (const { discardView } of this.getViews(offset, offset + count)) {
            discardView();
        }
    }
    async readAndDiscard(destAddress, offset, count) {
        try {
            await this.readInternal(destAddress >>> 0, toNumber(offset), toNumber(count), true);
            return {};
        }
        catch (e) {
            return { error: e };
        }
    }
    async readAndPreserve(destAddress, offset, count) {
        try {
            await this.readInternal(destAddress >>> 0, toNumber(offset), toNumber(count), false);
            return {};
        }
        catch (e) {
            return { error: e };
        }
    }
    discard(offset, count) {
        try {
            this.doDiscard(toNumber(offset), toNumber(count));
            return {};
        }
        catch (e) {
            return { error: e };
        }
    }
}
function toNumber(val) {
    if (typeof val === 'number') {
        return val;
    }
    if (val > Number.MAX_SAFE_INTEGER) {
        throw new Error(`BigInt value ${val} too large to be represented as a number`);
    }
    return Number(val);
}
//# sourceMappingURL=readable_stream_data_stream_wrapper.js.map