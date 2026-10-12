/**
 * Common shared domain & operation types.
 */

/**
 * Standard Result pattern for type-safe operation responses.
 */
export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Helper constructors for Result type.
 */
export const Result = {
  ok<T>(data: T): Result<T, never> {
    return { success: true, data };
  },
  err<E = string>(error: E): Result<never, E> {
    return { success: false, error };
  },
};

/**
 * Base database entity interface with audit timestamps.
 */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Generic pagination request parameters.
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/**
 * Generic paginated response wrapper.
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
