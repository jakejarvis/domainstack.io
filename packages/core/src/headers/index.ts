/**
 * Headers module.
 *
 * Pure HTTP header fetching logic shared by workflows and services.
 */

export { fetchHttpHeaders, HeadersFetchError } from "./fetch";
export { getHttpStatusMessage } from "./status-message";
export type { HeadersError, HeadersFetchData, HeadersFetchResult } from "./types";
