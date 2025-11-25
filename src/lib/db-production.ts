import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Production-optimized database configuration
const createPrismaClient = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  return new PrismaClient({
    // Optimized logging for production
    log: isProduction 
      ? [
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' }
        ]
      : [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'info' }
        ],
    
    // Production error format
    errorFormat: isProduction ? 'minimal' : 'pretty',
    
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });
};

// Global instance management
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create singleton instance
export const prisma = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Production event handlers
if (process.env.NODE_ENV === 'production') {
  // Log database errors in production
  prisma.$on('error', (e) => {
    logger.error('Database error occurred', {
      timestamp: new Date().toISOString(),
      target: e.target,
      message: e.message
    });
  });

  // Log warnings in production
  prisma.$on('warn', (e) => {
    logger.warn('Database warning', {
      timestamp: new Date().toISOString(),
      target: e.target,
      message: e.message
    });
  });
} else {
  // Development logging
  prisma.$on('query', (e) => {
    if (process.env.LOG_QUERIES === 'true') {
      console.log('Query:', e.query);
      console.log('Duration:', e.duration + 'ms');
    }
  });

  prisma.$on('error', (e) => {
    console.error('Database error:', e);
  });

  prisma.$on('warn', (e) => {
    console.warn('Database warning:', e);
  });

  prisma.$on('info', (e) => {
    console.info('Database info:', e);
  });
}

// Enhanced database health check with retry mechanism
export async function checkDatabaseConnection(retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Test basic connectivity
      await prisma.$queryRaw`SELECT 1`;
      
      // Test foreign key constraints are enabled
      const fkResult = await prisma.$queryRaw`PRAGMA foreign_keys` as Array<{ foreign_keys: number }>;
      
      if (fkResult.length === 0 || fkResult[0].foreign_keys !== 1) {
        logger.warn('Foreign key constraints are not enabled');
        
        // Enable foreign key constraints if not enabled
        await prisma.$executeRaw`PRAGMA foreign_keys = ON`;
        logger.info('Enabled foreign key constraints');
      }

      // Test database schema integrity
      const tableCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
      ` as Array<{ count: number }>;

      if (tableCount[0].count < 8) {
        throw new Error('Database schema appears incomplete');
      }

      logger.info(`Database connection successful (attempt ${attempt}/${retries})`);
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (attempt === retries) {
        logger.error(`Database connection failed after ${retries} attempts`, {
          error: errorMessage,
          attempt,
          retries
        });
        return false;
      }
      
      logger.warn(`Database connection attempt ${attempt} failed, retrying...`, {
        error: errorMessage,
        nextAttempt: attempt + 1,
        retries
      });
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  return false;
}

// Database performance optimization
export async function optimizeDatabase(): Promise<void> {
  try {
    // Analyze tables for query optimization
    await prisma.$executeRaw`ANALYZE`;
    
    // Optimize database (SQLite specific)
    await prisma.$executeRaw`PRAGMA optimize`;
    
    logger.info('Database optimization completed');
  } catch (error) {
    logger.error('Database optimization failed', { error });
  }
}

// Connection pool health monitoring
export async function getDatabaseStats(): Promise<{
  isConnected: boolean;
  foreignKeysEnabled: boolean;
  tableCount: number;
  indexCount: number;
  triggerCount: number;
  lastOptimized?: Date;
}> {
  try {
    // Check connection
    const isConnected = await checkDatabaseConnection(1);
    
    // Check foreign keys
    const fkResult = await prisma.$queryRaw`PRAGMA foreign_keys` as Array<{ foreign_keys: number }>;
    const foreignKeysEnabled = fkResult.length > 0 && fkResult[0].foreign_keys === 1;
    
    // Count schema objects
    const schemaStats = await prisma.$queryRaw`
      SELECT 
        SUM(CASE WHEN type='table' AND name NOT LIKE 'sqlite_%' THEN 1 ELSE 0 END) as table_count,
        SUM(CASE WHEN type='index' AND name NOT LIKE 'sqlite_%' THEN 1 ELSE 0 END) as index_count,
        SUM(CASE WHEN type='trigger' THEN 1 ELSE 0 END) as trigger_count
      FROM sqlite_master
    ` as Array<{ table_count: number; index_count: number; trigger_count: number }>;

    const stats = schemaStats[0];
    
    return {
      isConnected,
      foreignKeysEnabled,
      tableCount: stats.table_count,
      indexCount: stats.index_count,
      triggerCount: stats.trigger_count
    };
    
  } catch (error) {
    logger.error('Failed to get database stats', { error });
    throw error;
  }
}

// Graceful shutdown with connection cleanup
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Error during database disconnect', { error });
    throw error;
  }
}

// Database migration health check
export async function checkMigrationStatus(): Promise<{
  isUpToDate: boolean;
  pendingMigrations: string[];
  lastMigration?: string;
}> {
  try {
    // Check if migration tracking table exists
    const migrationTableExists = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='_prisma_migrations'
    ` as Array<{ name: string }>;

    if (migrationTableExists.length === 0) {
      return {
        isUpToDate: false,
        pendingMigrations: ['Initial migration required'],
        lastMigration: undefined
      };
    }

    // Get latest migration info (if using Prisma migrations)
    // Note: This is a simplified check - in production, integrate with your migration system
    const performanceIndexExists = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND name='idx_leads_auction_performance'
    ` as Array<{ name: string }>;

    const foreignKeyTableExists = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='orphaned_records_report'
    ` as Array<{ name: string }>;

    const pendingMigrations: string[] = [];
    
    if (performanceIndexExists.length === 0) {
      pendingMigrations.push('003_performance_optimization');
    }
    
    if (foreignKeyTableExists.length === 0) {
      pendingMigrations.push('004_foreign_key_fixes');
    }

    return {
      isUpToDate: pendingMigrations.length === 0,
      pendingMigrations,
      lastMigration: pendingMigrations.length === 0 ? '004_foreign_key_fixes' : undefined
    };
    
  } catch (error) {
    logger.error('Failed to check migration status', { error });
    throw error;
  }
}

// Production readiness check
export async function checkProductionReadiness(): Promise<{
  ready: boolean;
  checks: Array<{ name: string; passed: boolean; message: string }>;
}> {
  const checks = [];
  
  try {
    // Database connection check
    const isConnected = await checkDatabaseConnection(1);
    checks.push({
      name: 'Database Connection',
      passed: isConnected,
      message: isConnected ? 'Connected successfully' : 'Connection failed'
    });

    // Foreign key constraints check
    const fkResult = await prisma.$queryRaw`PRAGMA foreign_keys` as Array<{ foreign_keys: number }>;
    const fkEnabled = fkResult.length > 0 && fkResult[0].foreign_keys === 1;
    checks.push({
      name: 'Foreign Key Constraints',
      passed: fkEnabled,
      message: fkEnabled ? 'Foreign keys enabled' : 'Foreign keys disabled'
    });

    // Performance indexes check
    const performanceIndexCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='index' AND (
        name LIKE 'idx_%_performance%' OR
        name LIKE 'idx_%_coverage%' OR
        name LIKE 'idx_%_lookup%'
      )
    ` as Array<{ count: number }>;
    
    const hasPerformanceIndexes = performanceIndexCount[0].count >= 5;
    checks.push({
      name: 'Performance Indexes',
      passed: hasPerformanceIndexes,
      message: `${performanceIndexCount[0].count} performance indexes found`
    });

    // Data validation triggers check
    const triggerCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='trigger' AND name LIKE 'validate_%'
    ` as Array<{ count: number }>;
    
    const hasValidationTriggers = triggerCount[0].count >= 8;
    checks.push({
      name: 'Validation Triggers',
      passed: hasValidationTriggers,
      message: `${triggerCount[0].count} validation triggers found`
    });

    // Environment configuration check
    const hasProductionUrl = process.env.DATABASE_URL && 
      !process.env.DATABASE_URL.includes('dev.db');
    checks.push({
      name: 'Production Database URL',
      passed: hasProductionUrl,
      message: hasProductionUrl ? 'Production URL configured' : 'Using development database'
    });

    const allPassed = checks.every(check => check.passed);
    
    return {
      ready: allPassed,
      checks
    };
    
  } catch (error) {
    logger.error('Production readiness check failed', { error });
    checks.push({
      name: 'Readiness Check',
      passed: false,
      message: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    
    return {
      ready: false,
      checks
    };
  }
}

// Export default for backward compatibility
export default prisma;