import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { compileBlocker, ENGINE_PATH } from "./adblock.ts";

const blocker = await compileBlocker();
const serialized = blocker.serialize();
await mkdir(dirname(ENGINE_PATH), { recursive: true });
await writeFile(ENGINE_PATH, serialized);

console.log(`Wrote ${serialized.byteLength} byte ad-blocking engine to ${ENGINE_PATH}`);
