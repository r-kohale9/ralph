export class BufferedStreamReader {
  constructor(source, bufferSize) {
    this._isDone = false;
    this._isAborted = false;
    this._reader = null;
    this._abortController = null;
    this.source = source;
    this.bufferSize = bufferSize;
    this._abortController = new AbortController();
  }
  isDone() {
    return this._isDone;
  }
  isAborted() {
    return this._isAborted;
  }
  async abort() {
    var _a;
    if (this._isAborted) return;
    this._isAborted = true;
    // Signal abort to any ongoing operations
    (_a = this._abortController) === null || _a === void 0
      ? void 0
      : _a.abort();
    try {
      // If we have an active reader, cancel it first
      if (this._reader) {
        await this._reader.cancel();
        this._reader.releaseLock();
        this._reader = null;
      }
      // If source is a ReadableStream and not locked, cancel it
      if (this.source instanceof ReadableStream && !this.source.locked) {
        await this.source.cancel();
      }
    } catch (error) {
      // Ignore errors during abort - stream might already be closed
      console.debug("Error during stream abort (expected):", error);
    }
  }
  async read() {
    var _a, _b, _c;
    if (this._isAborted) {
      throw new Error("Reader has been aborted");
    }
    let stream;
    try {
      // Check if the source is a Request that needs fetching or an already-existing stream
      if (this.source instanceof Request) {
        const response = await fetch(this.source, {
          signal:
            (_a = this._abortController) === null || _a === void 0
              ? void 0
              : _a.signal,
        });
        if (!response.body) {
          throw new Error("Response has no body");
        }
        stream = response.body;
      } else {
        stream = this.source;
      }
      // Check if aborted before getting reader
      if (this._isAborted) {
        return;
      }
      this._reader = stream.getReader();
      let buffer = new Uint8Array(this.bufferSize);
      let bytesRead = 0;
      while (!this._isAborted) {
        let result;
        try {
          result = await this._reader.read();
        } catch (error) {
          if (this._isAborted) {
            // Expected error during abort
            break;
          }
          throw error;
        }
        const { value, done } = result;
        if (done) {
          if (bytesRead > 0 && !this._isAborted) {
            (_b = this.onBufferFull) === null || _b === void 0
              ? void 0
              : _b.call(this, {
                  bytes: buffer.slice(0, bytesRead),
                  done: true,
                });
          }
          this._isDone = true;
          break;
        }
        // Check if aborted before processing
        if (this._isAborted) {
          break;
        }
        let offset = 0;
        while (offset < value.length && !this._isAborted) {
          const remainingBufferSpace = this.bufferSize - bytesRead;
          const chunkLength = Math.min(
            remainingBufferSpace,
            value.length - offset
          );
          buffer.set(value.subarray(offset, offset + chunkLength), bytesRead);
          bytesRead += chunkLength;
          offset += chunkLength;
          if (bytesRead >= this.bufferSize && !this._isAborted) {
            (_c = this.onBufferFull) === null || _c === void 0
              ? void 0
              : _c.call(this, { bytes: buffer, done: false });
            buffer = new Uint8Array(this.bufferSize);
            bytesRead = 0;
          }
        }
      }
    } catch (error) {
      if (!this._isAborted) {
        console.error("Error in BufferedStreamReader:", error);
        throw error;
      }
      // If aborted, silently return
    } finally {
      // Clean up reader
      if (this._reader) {
        try {
          this._reader.releaseLock();
        } catch (_d) {
          // Reader might already be released
        }
        this._reader = null;
      }
    }
  }
}
