export type JsonTokenType = "key" | "string" | "number" | "boolean" | "null" | "punctuation";

export interface JsonToken {
  type: JsonTokenType;
  value: string;
}

/**
 * JSON token grammar for pretty-printed `JSON.stringify` output.
 * Group 1: string literal, group 2: optional key suffix (`:`),
 * group 3: number, group 4: boolean, group 5: null.
 */
const JSON_TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*")(\s*:)?|(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b/;

function tokensForMatch(match: RegExpMatchArray): JsonToken[] {
  const [, stringLiteral, keySuffix, numberLiteral, booleanLiteral, nullLiteral] = match;

  if (stringLiteral !== undefined) {
    const tokens: JsonToken[] = [
      { type: keySuffix === undefined ? "string" : "key", value: stringLiteral },
    ];
    if (keySuffix !== undefined) {
      tokens.push({ type: "punctuation", value: keySuffix });
    }
    return tokens;
  }

  if (numberLiteral !== undefined) {
    return [{ type: "number", value: numberLiteral }];
  }

  if (booleanLiteral !== undefined) {
    return [{ type: "boolean", value: booleanLiteral }];
  }

  return [{ type: "null", value: nullLiteral ?? "null" }];
}

/**
 * Tokenize pretty-printed JSON in one pass. Gaps (whitespace, braces, commas)
 * stay punctuation so joining token values always equals the source.
 */
export function tokenizeJson(source: string): JsonToken[][] {
  const re = new RegExp(JSON_TOKEN_PATTERN, "g");
  const lines: JsonToken[][] = [[]];

  const push = (type: JsonTokenType, value: string) => {
    if (value.length === 0) {
      return;
    }

    const parts = value.split("\n");
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        lines.push([]);
      }
      const part = parts[i];
      if (part) {
        lines[lines.length - 1]?.push({ type, value: part });
      }
    }
  };

  let lastIndex = 0;
  for (const match of source.matchAll(re)) {
    const index = match.index;
    push("punctuation", source.slice(lastIndex, index));
    for (const token of tokensForMatch(match)) {
      push(token.type, token.value);
    }
    lastIndex = index + match[0].length;
  }
  push("punctuation", source.slice(lastIndex));

  return lines;
}
