import { Prisma } from '../../../generated';

/**
 * Utility class for handling Decimal operations with proper precision
 * Prevents floating-point precision loss in financial calculations
 */
export class DecimalUtils {
  /**
   * Safely add two Decimal values
   * @param a - First Decimal value
   * @param b - Second Decimal value
   * @returns Sum as Decimal
   *
   * @example
   * const total = DecimalUtils.add(new Prisma.Decimal('1000000.10'), new Prisma.Decimal('100000.50'));
   * // Returns: 1100000.60 (exact precision maintained)
   */
  static add(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
    return new Prisma.Decimal(a.plus(b).toString());
  }

  /**
   * Safely subtract two Decimal values
   * @param a - Value to subtract from
   * @param b - Value to subtract
   * @returns Difference as Decimal
   */
  static subtract(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
    return new Prisma.Decimal(a.minus(b).toString());
  }

  /**
   * Safely multiply two Decimal values
   * @param a - First Decimal value
   * @param b - Second Decimal value
   * @returns Product as Decimal
   */
  static multiply(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
    return new Prisma.Decimal(a.times(b).toString());
  }

  /**
   * Safely divide two Decimal values
   * @param a - Dividend
   * @param b - Divisor
   * @returns Quotient as Decimal
   * @throws Error if divisor is zero
   */
  static divide(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
    if (b.isZero()) {
      throw new Error('Cannot divide by zero');
    }
    return new Prisma.Decimal(a.dividedBy(b).toString());
  }

  /**
   * Convert Decimal to number for JSON serialization
   * Use this for API responses
   * @param decimal - Decimal value to convert
   * @returns Number representation
   */
  static toNumber(decimal: Prisma.Decimal): number {
    return parseFloat(decimal.toString());
  }

  /**
   * Convert number or string to Decimal
   * @param value - Number or string to convert
   * @returns Decimal value
   */
  static fromValue(value: number | string): Prisma.Decimal {
    return new Prisma.Decimal(value.toString());
  }

  /**
   * Round Decimal to specified decimal places
   * @param decimal - Decimal value to round
   * @param decimalPlaces - Number of decimal places (default: 0)
   * @returns Rounded Decimal
   */
  static round(decimal: Prisma.Decimal, decimalPlaces = 0): Prisma.Decimal {
    return new Prisma.Decimal(decimal.toFixed(decimalPlaces));
  }

  /**
   * Compare two Decimal values
   * @param a - First value
   * @param b - Second value
   * @returns -1 if a < b, 0 if a == b, 1 if a > b
   */
  static compare(a: Prisma.Decimal, b: Prisma.Decimal): number {
    return a.comparedTo(b);
  }

  /**
   * Check if Decimal is zero
   * @param decimal - Decimal to check
   * @returns true if zero
   */
  static isZero(decimal: Prisma.Decimal): boolean {
    return decimal.isZero();
  }

  /**
   * Get maximum of two Decimal values
   * @param a - First value
   * @param b - Second value
   * @returns The larger value
   */
  static max(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
    return a.greaterThan(b) ? a : b;
  }

  /**
   * Get minimum of two Decimal values
   * @param a - First value
   * @param b - Second value
   * @returns The smaller value
   */
  static min(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
    return a.lessThan(b) ? a : b;
  }
}
