import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../../generated';

/**
 * System Variables Service
 * Manages system-wide configuration variables with caching
 */
@Injectable()
export class SystemVariablesService {
  private readonly logger = new Logger(SystemVariablesService.name);
  private cache = new Map<string, unknown>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get a single system variable by category and key
   * Returns cached value if available and not expired
   */
  async get<T = unknown>(category: string, key: string): Promise<T> {
    const fullKey = `${category}.${key}`;

    // Check cache
    if (this.cache.has(fullKey)) {
      const expiry = this.cacheExpiry.get(fullKey);
      if (expiry && Date.now() < expiry) {
        this.logger.debug(`Cache hit for ${fullKey}`);
        return this.cache.get(fullKey) as T;
      }
    }

    // Fetch from database
    this.logger.debug(`Cache miss for ${fullKey}, fetching from database`);
    const variable = await this.prisma.systemVariable.findUnique({
      where: {
        category_key: {
          category,
          key: fullKey,
        },
      },
    });

    if (!variable) {
      throw new NotFoundException(`System variable not found: ${fullKey}`);
    }

    if (!variable.isActive) {
      throw new NotFoundException(`System variable is inactive: ${fullKey}`);
    }

    // Parse based on dataType
    const parsedValue = this.parseValue(variable.value, variable.dataType);

    // Cache it
    this.cache.set(fullKey, parsedValue);
    this.cacheExpiry.set(fullKey, Date.now() + this.CACHE_TTL);

    return parsedValue as T;
  }

  /**
   * Get all variables in a category as an object
   */
  async getCategory(category: string): Promise<Record<string, unknown>> {
    const variables = await this.prisma.systemVariable.findMany({
      where: { category, isActive: true },
    });

    const result: Record<string, unknown> = {};
    for (const variable of variables) {
      // Remove category prefix from key for cleaner result
      const shortKey = variable.key.replace(`${category}.`, '');
      result[shortKey] = this.parseValue(variable.value, variable.dataType);
    }

    return result;
  }

  /**
   * Get all variables across all categories
   */
  async getAllVariables(): Promise<Record<string, Record<string, unknown>>> {
    const variables = await this.prisma.systemVariable.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    const result: Record<string, Record<string, unknown>> = {};

    for (const variable of variables) {
      if (!result[variable.category]) {
        result[variable.category] = {};
      }
      const shortKey = variable.key.replace(`${variable.category}.`, '');
      result[variable.category][shortKey] = this.parseValue(
        variable.value,
        variable.dataType
      );
    }

    return result;
  }

  /**
   * Update a system variable
   */
  async update(
    category: string,
    key: string,
    value: string,
    updatedBy?: string
  ) {
    const fullKey = `${category}.${key}`;

    // First check if the variable exists
    const existing = await this.prisma.systemVariable.findUnique({
      where: {
        category_key: {
          category,
          key: fullKey,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`System variable not found: ${fullKey}`);
    }

    const updated = await this.prisma.systemVariable.update({
      where: {
        category_key: {
          category,
          key: fullKey,
        },
      },
      data: {
        value,
        updatedBy,
        updatedAt: new Date(),
      },
    });

    // Invalidate cache for this key
    this.cache.delete(fullKey);
    this.cacheExpiry.delete(fullKey);

    this.logger.log(`Updated system variable: ${fullKey} = ${value}`);

    return updated;
  }

  /**
   * Create a new system variable
   */
  async create(
    category: string,
    key: string,
    value: string,
    dataType: 'number' | 'boolean' | 'string' | 'json',
    description?: string
  ) {
    const fullKey = `${category}.${key}`;

    try {
      const created = await this.prisma.systemVariable.create({
        data: {
          category,
          key: fullKey,
          value,
          dataType,
          description,
        },
      });

      this.logger.log(`Created system variable: ${fullKey}`);

      return created;
    } catch (error) {
      // Handle unique constraint violation (duplicate key)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `System variable already exists: ${fullKey}`
        );
      }
      throw error;
    }
  }

  /**
   * Parse value based on data type
   */
  private parseValue(value: string, dataType: string): unknown {
    try {
      switch (dataType) {
        case 'number':
          return parseFloat(value);
        case 'boolean':
          return value.toLowerCase() === 'true';
        case 'json':
          return JSON.parse(value) as unknown;
        case 'string':
        default:
          return value;
      }
    } catch (error) {
      this.logger.error(
        `Failed to parse value "${value}" as ${dataType}`,
        error
      );
      return value; // Return as string if parsing fails
    }
  }

  /**
   * Clear all cached values
   */
  clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
    this.logger.log('System variables cache cleared');
  }

  /**
   * Clear cache for a specific category
   */
  clearCategoryCache(category: string) {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${category}.`)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
    }

    this.logger.log(`Cleared cache for category: ${category}`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [, expiry] of this.cacheExpiry.entries()) {
      if (now < expiry) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      cacheTTL: this.CACHE_TTL,
    };
  }
}
