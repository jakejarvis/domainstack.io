/**
 * Generic workflow result type for data-returning workflows.
 * Discriminated union for type safety:
 * - success: true → data is TData
 * - success: false → data is null, error is TError
 *
 * Used by workflows that integrate with the SWR caching helper.
 *
 * @template TData - The data type returned on success
 * @template TError - The error type (defaults to string, can be a union of literals)
 */
export type WorkflowResult<TData, TError extends string = string> =
  | {
      success: true;
      data: TData;
    }
  | {
      success: false;
      data: null;
      error: TError;
    };
