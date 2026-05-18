import { performance } from 'perf_hooks';

// Generate dummy data
const lines = [];
for (let i = 0; i < 100000; i++) {
  if (i % 10 === 0) {
    lines.push("# comment");
  } else if (i % 5 === 0) {
    lines.push("  *.example-" + i + ".com  ");
  } else if (i % 7 === 0) {
    lines.push("invalid domain");
  } else {
    lines.push("example-" + i + ".com");
  }
}
const text = lines.join("\n");

function original(text) {
  const lines = text.split("\n");
  const domains = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const domain = trimmed.startsWith("*.") ? trimmed.slice(2) : trimmed;

    if (
      domain?.includes(".") &&
      !domain.includes(" ") &&
      domain.length <= 253 &&
      !domain.startsWith(".") &&
      !domain.endsWith(".")
    ) {
      domains.push(domain.toLowerCase());
    }
  }
  return domains;
}

function optimized_clean_no_split(text) {
  const domains = [];
  let start = 0;
  const len = text.length;

  while (start < len) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = len;

    let tStart = start;
    let tEnd = end - 1;

    // Fast trim whitespace/carriage returns
    while (tStart <= tEnd && text.charCodeAt(tStart) <= 32) tStart++;
    while (tEnd >= tStart && text.charCodeAt(tEnd) <= 32) tEnd--;

    start = end + 1;

    if (tStart > tEnd || text.charCodeAt(tStart) === 35) continue; // Empty or #

    // Check for "*."
    if (tEnd - tStart >= 1 && text.charCodeAt(tStart) === 42 && text.charCodeAt(tStart + 1) === 46) {
      tStart += 2;
    }

    const dLen = tEnd - tStart + 1;
    if (dLen > 253 || dLen < 3 || text.charCodeAt(tStart) === 46 || text.charCodeAt(tEnd) === 46) {
      continue;
    }

    let hasDot = false;
    let valid = true;
    for (let i = tStart + 1; i < tEnd; i++) {
      const c = text.charCodeAt(i);
      if (c === 46) hasDot = true;
      else if (c <= 32) {
        valid = false;
        break;
      }
    }

    if (valid && hasDot) {
      domains.push(text.slice(tStart, tEnd + 1).toLowerCase());
    }
  }

  return domains;
}

// Check correctness
const r1 = original(text);
const r2 = optimized_clean_no_split(text);
console.log("Correctness r2:", r1.length === r2.length && r1.every((val, index) => val === r2[index]));

const startOriginal = performance.now();
for (let i = 0; i < 100; i++) {
  original(text);
}
const endOriginal = performance.now();

const startOpt2 = performance.now();
for (let i = 0; i < 100; i++) {
  optimized_clean_no_split(text);
}
const endOpt2 = performance.now();

console.log("Original: " + (endOriginal - startOriginal).toFixed(2) + "ms");
console.log("Optimized clean no-split: " + (endOpt2 - startOpt2).toFixed(2) + "ms");
