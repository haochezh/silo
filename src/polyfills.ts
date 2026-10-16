import { Buffer } from "buffer";

// @solana/web3.js expects Node's Buffer in the browser.
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer ??= Buffer;
