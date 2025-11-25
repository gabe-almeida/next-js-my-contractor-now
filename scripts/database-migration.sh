#!/bin/bash

# =====================================================================================
# DATABASE MIGRATION SCRIPT
# Purpose: Apply database performance optimizations and fixes safely
# Version: 1.0
# Date: 2025-08-25
# =====================================================================================

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PRISMA_DIR="$PROJECT_DIR/prisma"
BACKUP_DIR="$PROJECT_DIR/backups/database"
LOG_FILE="$PROJECT_DIR/logs/migration.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "${RED}ERROR: $1${NC}"
}

success() {
    log "${GREEN}SUCCESS: $1${NC}"
}

warning() {
    log "${YELLOW}WARNING: $1${NC}"
}

info() {
    log "${BLUE}INFO: $1${NC}"
}

# Create necessary directories
create_directories() {
    info "Creating necessary directories..."
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "$PRISMA_DIR/migrations/003_performance_optimization"
    mkdir -p "$PRISMA_DIR/migrations/004_foreign_key_fixes"
}

# Database backup function
backup_database() {
    info "Creating database backup..."
    
    if [ ! -f "$PRISMA_DIR/dev.db" ]; then
        error "Database file not found at $PRISMA_DIR/dev.db"
        return 1
    fi
    
    local backup_file="$BACKUP_DIR/dev_backup_$(date +%Y%m%d_%H%M%S).db"
    cp "$PRISMA_DIR/dev.db" "$backup_file"
    
    if [ $? -eq 0 ]; then
        success "Database backed up to $backup_file"
        echo "$backup_file" > "$BACKUP_DIR/latest_backup.txt"
        return 0
    else
        error "Database backup failed"
        return 1
    fi
}

# Check database integrity
check_database_integrity() {
    info "Checking database integrity..."
    
    cd "$PROJECT_DIR"
    
    # Check if we can connect to the database
    if ! npm run db:generate > /dev/null 2>&1; then
        error "Cannot connect to database or generate client"
        return 1
    fi
    
    # Run integrity check using sqlite3 if available
    if command -v sqlite3 &> /dev/null; then
        if ! sqlite3 "$PRISMA_DIR/dev.db" "PRAGMA integrity_check;" | grep -q "ok"; then
            error "Database integrity check failed"
            return 1
        fi
        success "Database integrity check passed"
    else
        warning "sqlite3 not available, skipping integrity check"
    fi
    
    return 0
}

# Apply migration with rollback capability
apply_migration() {
    local migration_file="$1"
    local migration_name="$2"
    
    info "Applying migration: $migration_name"
    
    # Check if migration file exists
    if [ ! -f "$migration_file" ]; then
        error "Migration file not found: $migration_file"
        return 1
    fi
    
    # Create rollback point
    local rollback_file="$BACKUP_DIR/rollback_before_${migration_name}_$(date +%Y%m%d_%H%M%S).db"
    cp "$PRISMA_DIR/dev.db" "$rollback_file"
    
    # Apply migration
    cd "$PROJECT_DIR"
    if sqlite3 "$PRISMA_DIR/dev.db" < "$migration_file"; then
        success "Migration $migration_name applied successfully"
        return 0
    else
        error "Migration $migration_name failed"
        
        # Rollback on failure
        warning "Rolling back to previous state..."
        cp "$rollback_file" "$PRISMA_DIR/dev.db"
        
        if [ $? -eq 0 ]; then
            warning "Rollback completed"
        else
            error "Rollback failed! Manual intervention required"
        fi
        
        return 1
    fi
}

# Validate migration results
validate_migration() {
    local migration_name="$1"
    
    info "Validating migration: $migration_name"
    
    cd "$PROJECT_DIR"
    
    case "$migration_name" in
        "003_performance_optimization")
            # Check if performance indexes were created
            local index_count=$(sqlite3 "$PRISMA_DIR/dev.db" "
                SELECT COUNT(*) FROM sqlite_master 
                WHERE type='index' AND (
                    name LIKE 'idx_%_performance%' OR
                    name LIKE 'idx_%_coverage%' OR
                    name LIKE 'idx_%_lookup%'
                );
            ")
            
            if [ "$index_count" -ge 5 ]; then
                success "Performance indexes created: $index_count"
            else
                error "Expected at least 5 performance indexes, found: $index_count"
                return 1
            fi
            
            # Check if validation triggers were created
            local trigger_count=$(sqlite3 "$PRISMA_DIR/dev.db" "
                SELECT COUNT(*) FROM sqlite_master 
                WHERE type='trigger' AND name LIKE 'validate_%';
            ")
            
            if [ "$trigger_count" -ge 8 ]; then
                success "Validation triggers created: $trigger_count"
            else
                error "Expected at least 8 validation triggers, found: $trigger_count"
                return 1
            fi
            ;;
            
        "004_foreign_key_fixes")
            # Check foreign key constraints
            local fk_enabled=$(sqlite3 "$PRISMA_DIR/dev.db" "PRAGMA foreign_keys;")
            
            if [ "$fk_enabled" = "1" ]; then
                success "Foreign key constraints enabled"
            else
                warning "Foreign key constraints not enabled"
            fi
            
            # Check if orphaned records report table exists
            local orphan_table_exists=$(sqlite3 "$PRISMA_DIR/dev.db" "
                SELECT COUNT(*) FROM sqlite_master 
                WHERE type='table' AND name='orphaned_records_report';
            ")
            
            if [ "$orphan_table_exists" = "1" ]; then
                success "Orphaned records report table created"
                
                # Show orphaned records count
                local orphan_count=$(sqlite3 "$PRISMA_DIR/dev.db" "
                    SELECT COUNT(*) FROM orphaned_records_report;
                ")
                
                if [ "$orphan_count" -gt 0 ]; then
                    warning "Found $orphan_count orphaned records - review required"
                else
                    success "No orphaned records found"
                fi
            else
                error "Orphaned records report table not found"
                return 1
            fi
            ;;
    esac
    
    return 0
}

# Run performance tests
run_performance_tests() {
    info "Running performance tests..."
    
    cd "$PROJECT_DIR"
    
    # Test auction query performance
    info "Testing auction query performance..."
    local query_time=$(sqlite3 "$PRISMA_DIR/dev.db" ".timer ON" "
        SELECT COUNT(*) FROM buyer_service_zip_codes bsz
        JOIN buyers b ON bsz.buyer_id = b.id
        JOIN buyer_service_configs bsc ON bsc.buyer_id = b.id 
            AND bsc.service_type_id = bsz.service_type_id
        WHERE bsz.service_type_id LIKE '%'
            AND bsz.zip_code LIKE '%'
            AND bsz.active = 1
            AND b.active = 1
            AND bsc.active = 1;
    " 2>&1 | grep "CPU")
    
    if [ -n "$query_time" ]; then
        info "Query performance: $query_time"
    fi
    
    # Run any existing performance tests
    if [ -f "package.json" ] && grep -q "test.*performance" package.json; then
        info "Running automated performance tests..."
        if npm run test -- --testPathPattern=performance; then
            success "Performance tests passed"
        else
            warning "Some performance tests failed"
        fi
    fi
}

# Generate migration report
generate_report() {
    local report_file="$PROJECT_DIR/docs/migration-report-$(date +%Y%m%d_%H%M%S).md"
    
    info "Generating migration report..."
    
    cat > "$report_file" << EOF
# Database Migration Report

**Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Environment:** ${NODE_ENV:-development}

## Migration Summary

### Applied Migrations
- ✅ 003_performance_optimization
- ✅ 004_foreign_key_fixes

### Database Statistics

#### Performance Indexes
\`\`\`sql
$(sqlite3 "$PRISMA_DIR/dev.db" "
SELECT name, sql FROM sqlite_master 
WHERE type='index' AND name LIKE 'idx_%' 
ORDER BY name;
")
\`\`\`

#### Validation Triggers
\`\`\`sql
$(sqlite3 "$PRISMA_DIR/dev.db" "
SELECT name FROM sqlite_master 
WHERE type='trigger' AND name LIKE 'validate_%' 
ORDER BY name;
")
\`\`\`

#### Foreign Key Status
\`\`\`
Foreign Keys Enabled: $(sqlite3 "$PRISMA_DIR/dev.db" "PRAGMA foreign_keys;")
\`\`\`

### Data Integrity Check
$(sqlite3 "$PRISMA_DIR/dev.db" "
SELECT * FROM v_foreign_key_validation;
" 2>/dev/null || echo "Validation view not available")

### Orphaned Records Report
$(sqlite3 "$PRISMA_DIR/dev.db" "
SELECT orphan_type, COUNT(*) as count 
FROM orphaned_records_report 
GROUP BY orphan_type;
" 2>/dev/null || echo "No orphaned records report available")

## Next Steps

1. Review any orphaned records and clean up if necessary
2. Monitor query performance in production
3. Consider scaling to PostgreSQL if concurrent load increases
4. Update application code to use new performance features

---
*Generated by database-migration.sh*
EOF

    success "Migration report generated: $report_file"
}

# Main migration function
main() {
    info "Starting database migration process..."
    
    # Check prerequisites
    if [ ! -f "$PROJECT_DIR/package.json" ]; then
        error "Not in a Node.js project directory"
        exit 1
    fi
    
    if [ ! -f "$PROJECT_DIR/prisma/schema.prisma" ]; then
        error "Prisma schema not found"
        exit 1
    fi
    
    # Create directories
    create_directories
    
    # Create backup
    if ! backup_database; then
        error "Failed to create backup. Aborting migration."
        exit 1
    fi
    
    # Check database integrity
    if ! check_database_integrity; then
        error "Database integrity check failed. Aborting migration."
        exit 1
    fi
    
    # Apply migrations
    local migration_dir="$PROJECT_DIR/prisma/migrations"
    
    # Migration 003: Performance optimization
    if apply_migration "$migration_dir/003_performance_optimization/migration.sql" "003_performance_optimization"; then
        if validate_migration "003_performance_optimization"; then
            success "Migration 003 completed successfully"
        else
            error "Migration 003 validation failed"
            exit 1
        fi
    else
        error "Migration 003 failed"
        exit 1
    fi
    
    # Migration 004: Foreign key fixes
    if apply_migration "$migration_dir/004_foreign_key_fixes/migration.sql" "004_foreign_key_fixes"; then
        if validate_migration "004_foreign_key_fixes"; then
            success "Migration 004 completed successfully"
        else
            error "Migration 004 validation failed"
            exit 1
        fi
    else
        error "Migration 004 failed"
        exit 1
    fi
    
    # Final integrity check
    if ! check_database_integrity; then
        error "Final integrity check failed"
        exit 1
    fi
    
    # Run performance tests
    run_performance_tests
    
    # Generate report
    generate_report
    
    # Regenerate Prisma client
    info "Regenerating Prisma client..."
    cd "$PROJECT_DIR"
    if npm run db:generate; then
        success "Prisma client regenerated"
    else
        warning "Failed to regenerate Prisma client - manual intervention may be required"
    fi
    
    success "Database migration completed successfully!"
    info "Backup location: $(cat "$BACKUP_DIR/latest_backup.txt" 2>/dev/null || echo "Unknown")"
    info "Log file: $LOG_FILE"
    
    # Show summary
    echo
    echo "==================================="
    echo "MIGRATION SUMMARY"
    echo "==================================="
    sqlite3 "$PRISMA_DIR/dev.db" "
        SELECT 'Tables' as type, COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
        UNION ALL
        SELECT 'Indexes' as type, COUNT(*) as count FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'
        UNION ALL
        SELECT 'Triggers' as type, COUNT(*) as count FROM sqlite_master WHERE type='trigger'
        UNION ALL
        SELECT 'Views' as type, COUNT(*) as count FROM sqlite_master WHERE type='view';
    " | column -t
    echo "==================================="
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Database Migration Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --dry-run      Show what would be done without making changes"
        echo "  --backup-only  Only create a backup"
        echo ""
        echo "The script will:"
        echo "  1. Create a database backup"
        echo "  2. Apply performance optimization migration (003)"
        echo "  3. Apply foreign key fixes migration (004)"
        echo "  4. Validate all changes"
        echo "  5. Generate a migration report"
        ;;
    --dry-run)
        info "DRY RUN MODE - No changes will be made"
        info "Would create backup of: $PRISMA_DIR/dev.db"
        info "Would apply migrations:"
        info "  - 003_performance_optimization"
        info "  - 004_foreign_key_fixes"
        info "Would validate and generate report"
        ;;
    --backup-only)
        create_directories
        backup_database
        ;;
    "")
        main
        ;;
    *)
        error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac