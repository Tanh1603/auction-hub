import { Logger } from '@nestjs/common';

const logger = new Logger('JSONUtils');

/**
 * Utility class for safe JSON parsing operations
 * Prevents application crashes from malformed JSON data
 */
export class JSONUtils {
  /**
   * Safely parse JSON with fallback value
   * Logs parsing errors for debugging but doesn't crash the application
   *
   * @param jsonString - The JSON string to parse
   * @param fallback - Value to return if parsing fails
   * @param context - Context string for logging (e.g., "commission tiers", "dossier fees")
   * @returns Parsed object or fallback value
   *
   * @example
   * const tiers = JSONUtils.safeParse(policy.commissionConfig.tiers, [], 'commission tiers');
   * // Returns parsed array or empty array if invalid
   */
  static safeParse<T>(
    jsonString: string | null | undefined,
    fallback: T,
    context = 'unknown'
  ): T {
    // Handle null/undefined
    if (jsonString === null || jsonString === undefined) {
      logger.debug(`JSON string is null/undefined for context: ${context}`);
      return fallback;
    }

    // Handle empty string
    if (typeof jsonString === 'string' && jsonString.trim() === '') {
      logger.debug(`JSON string is empty for context: ${context}`);
      return fallback;
    }

    // Handle already parsed objects (shouldn't happen, but defensive)
    if (typeof jsonString === 'object') {
      logger.debug(`Value is already an object for context: ${context}`);
      return jsonString as unknown as T;
    }

    try {
      const parsed = JSON.parse(jsonString);
      return parsed as T;
    } catch (error) {
      logger.warn(
        `Failed to parse JSON for context "${context}". ` +
          `Error: ${
            error instanceof Error ? error.message : 'Unknown error'
          }. ` +
          `Value: ${jsonString.substring(0, 100)}${
            jsonString.length > 100 ? '...' : ''
          }. ` +
          `Using fallback value.`
      );
      return fallback;
    }
  }

  /**
   * Safely stringify with error handling
   * @param value - Value to stringify
   * @param fallback - Fallback string if stringify fails
   * @param context - Context for logging
   * @returns JSON string or fallback
   */
  static safeStringify(
    value: unknown,
    fallback = '{}',
    context = 'unknown'
  ): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      logger.error(
        `Failed to stringify value for context "${context}". ` +
          `Error: ${
            error instanceof Error ? error.message : 'Unknown error'
          }. ` +
          `Using fallback value.`
      );
      return fallback;
    }
  }

  /**
   * Parse JSON array with validation
   * Ensures the result is actually an array
   *
   * @param jsonString - JSON string to parse
   * @param context - Context for logging
   * @returns Parsed array or empty array
   */
  static parseArray<T = unknown>(
    jsonString: string | null | undefined,
    context = 'unknown'
  ): T[] {
    const result = this.safeParse<T[]>(jsonString, [], context);

    if (!Array.isArray(result)) {
      logger.warn(
        `Expected array for context "${context}", but got ${typeof result}. Returning empty array.`
      );
      return [];
    }

    return result;
  }

  /**
   * Parse JSON object with validation
   * Ensures the result is actually an object
   *
   * @param jsonString - JSON string to parse
   * @param context - Context for logging
   * @returns Parsed object or empty object
   */
  static parseObject<T extends Record<string, unknown>>(
    jsonString: string | null | undefined,
    context = 'unknown'
  ): T {
    const result = this.safeParse<T>(jsonString, {} as T, context);

    if (
      typeof result !== 'object' ||
      result === null ||
      Array.isArray(result)
    ) {
      logger.warn(
        `Expected object for context "${context}", but got ${typeof result}. Returning empty object.`
      );
      return {} as T;
    }

    return result;
  }
}
