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

/**
 * Result from persist steps, includes lastAccessedAt for scheduling revalidation.
 *
 * Persist steps are pure database operations that return metadata needed for
 * scheduling the next revalidation at the workflow level.
 */
export interface PersistResult {
  /** When the domain was last accessed by a user, used for decay calculation */
  lastAccessedAt: Date | null;
}

/**
 * Extended persist result for registration workflow.
 *
 * Registration persist step also returns the domain ID since it may create
 * the domain record (unlike other persist steps which use ensureDomainRecord).
 */
export interface RegistrationPersistResult extends PersistResult {
  /** The ID of the persisted domain record */
  domainId: string;
}
