import { writeFile } from "node:fs/promises";

import { compileBlocker, ENGINE_PATH } from "./adblock.js";

const blocker = await compileBlocker();
const serialized = blocker.serialize();
await writeFile(ENGINE_PATH, serialized);

console.log(`Wrote ${serialized.byteLength} byte ad-blocking engine to ${ENGINE_PATH}`);
