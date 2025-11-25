# Load Testing with k6

This directory contains k6 load tests for performance and stress testing the contractor platform API.

## Prerequisites

### Install k6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**
```bash
choco install k6
```

**Docker:**
```bash
docker pull grafana/k6:latest
```

## Test Files

### 1. smoke-test.js
**Purpose:** Quick verification that all endpoints are functional
**Load:** 5 concurrent users for 1 minute
**Use when:** Before running heavier load tests, after deployments

```bash
k6 run tests/load/smoke-test.js
```

**Expected Results:**
- ✓ All endpoints return 200 status
- ✓ Response times < 1s
- ✓ Error rate < 1%

---

### 2. lead-submission-load.js
**Purpose:** Test lead submission endpoint under realistic load
**Load:** Ramps from 10 → 50 → 100 concurrent users over 26 minutes
**Use when:** Testing lead ingestion capacity

```bash
# Default run
k6 run tests/load/lead-submission-load.js

# Custom load
k6 run --vus 50 --duration 5m tests/load/lead-submission-load.js

# With custom base URL
k6 run -e BASE_URL=https://staging.example.com tests/load/lead-submission-load.js
```

**Expected Results:**
- ✓ 95% of requests complete in < 2s
- ✓ Error rate < 1%
- ✓ Successful lead creation

**Metrics to Watch:**
- `lead_creation_time` - Time to create lead
- `successful_leads` - Count of successful submissions
- `failed_leads` - Count of failures

---

### 3. api-endpoints-load.js
**Purpose:** Test multiple admin API endpoints concurrently
**Load:** Ramps from 20 → 50 → 100 users over 13 minutes
**Use when:** Testing admin panel performance

```bash
k6 run -e ADMIN_TOKEN=your-token-here tests/load/api-endpoints-load.js
```

**Endpoints Tested:**
- GET /api/admin/buyers
- GET /api/service-types
- GET /api/admin/leads
- GET /api/admin/buyers/service-configs
- GET /api/admin/service-zones

**Expected Results:**
- ✓ Buyers endpoint: p95 < 1s
- ✓ Service types: p95 < 800ms
- ✓ Leads endpoint: p95 < 1.2s
- ✓ Error rate < 2%

---

### 4. auction-stress-test.js
**Purpose:** Stress test the auction engine with concurrent auctions
**Load:** 50 req/s constant + spike to 150 req/s
**Use when:** Testing auction engine scalability

```bash
k6 run tests/load/auction-stress-test.js
```

**Test Phases:**
1. **Constant load:** 50 leads/sec for 2 minutes
2. **Spike test:** Ramp from 10 → 150 leads/sec over 2.5 minutes

**Expected Results:**
- ✓ Auction success rate > 95%
- ✓ 95% of auctions complete in < 5s
- ✓ Handles concurrent auctions gracefully

**Metrics to Watch:**
- `auction_success_rate` - Percentage of successful auctions
- `auction_duration` - Time to complete auction
- `concurrent_auctions` - Peak concurrent auctions

---

### 5. database-pool-stress.js
**Purpose:** Stress test database connection pool limits
**Load:** Ramps to 200 concurrent database queries
**Use when:** Testing database scalability and connection pool configuration

```bash
k6 run tests/load/database-pool-stress.js
```

**Test Phases:**
- Ramp to 50 concurrent users (1.5 min)
- Ramp to 100 concurrent users (1.5 min)
- Spike to 200 concurrent users (1.5 min)
- Hold at 200 (1 min)

**Expected Results:**
- ✓ Query success rate > 95%
- ✓ p95 query duration < 2s
- ✓ Connection errors < 50

**Metrics to Watch:**
- `query_success_rate` - Percentage of successful queries
- `connection_errors` - Count of connection pool exhaustion
- `active_connections` - Peak concurrent connections

---

## Running Tests

### Basic Usage

```bash
# Run a single test
k6 run tests/load/smoke-test.js

# Run with custom duration and VUs
k6 run --vus 20 --duration 2m tests/load/api-endpoints-load.js

# Run with environment variables
k6 run -e BASE_URL=http://localhost:3000 tests/load/smoke-test.js
```

### Advanced Options

```bash
# Save results to JSON
k6 run --out json=results.json tests/load/lead-submission-load.js

# Run with specific scenario
k6 run --scenario constant_load tests/load/auction-stress-test.js

# Run with custom thresholds
k6 run --threshold http_req_duration=p(95)<1000 tests/load/smoke-test.js
```

### Docker Usage

```bash
# Run test in Docker
docker run --rm -i grafana/k6:latest run - <tests/load/smoke-test.js

# With volume mount
docker run --rm -v $(pwd)/tests/load:/tests grafana/k6:latest run /tests/smoke-test.js
```

## Environment Variables

All tests support these environment variables:

- `BASE_URL` - Base URL of the API (default: `http://localhost:3000`)
- `ADMIN_TOKEN` - Admin authentication token for protected endpoints

Example:
```bash
k6 run -e BASE_URL=https://staging.example.com -e ADMIN_TOKEN=abc123 tests/load/api-endpoints-load.js
```

## Interpreting Results

### Key Metrics

**http_req_duration:**
- `p(95)` - 95th percentile response time
- `p(99)` - 99th percentile response time
- `avg` - Average response time

**http_req_failed:**
- `rate` - Percentage of failed requests (aim for < 1%)

**Custom Metrics:**
- Check each test file for specific metrics like `auction_success_rate`, `query_duration`, etc.

### Success Criteria

✅ **Pass:**
- p95 response time within thresholds
- Error rate < 1-2%
- All custom metrics meet thresholds

⚠️ **Warning:**
- p95 response time near threshold limits
- Error rate 2-5%
- Occasional connection errors

❌ **Fail:**
- p95 response time exceeds thresholds
- Error rate > 5%
- Frequent connection/timeout errors

## Recommended Test Sequence

Run tests in this order for comprehensive coverage:

1. **Smoke Test** (1 min)
   ```bash
   k6 run tests/load/smoke-test.js
   ```
   Verify all endpoints work before heavy testing

2. **API Endpoints Load** (13 min)
   ```bash
   k6 run tests/load/api-endpoints-load.js
   ```
   Test admin panel performance

3. **Lead Submission Load** (26 min)
   ```bash
   k6 run tests/load/lead-submission-load.js
   ```
   Test lead ingestion capacity

4. **Auction Stress Test** (5 min)
   ```bash
   k6 run tests/load/auction-stress-test.js
   ```
   Test auction engine under stress

5. **Database Pool Stress** (6 min)
   ```bash
   k6 run tests/load/database-pool-stress.js
   ```
   Test database connection limits

**Total runtime:** ~51 minutes for full suite

## Performance Benchmarks

### Target Performance (95th percentile):

| Endpoint | Response Time | Throughput |
|----------|--------------|------------|
| Lead Submission | < 2s | 100 req/s |
| Buyers API | < 1s | 200 req/s |
| Service Types | < 800ms | 500 req/s |
| Leads API | < 1.2s | 150 req/s |
| Auction Engine | < 5s | 50 auctions/s |

### Resource Limits:

- **Database connections:** Test up to 200 concurrent
- **Concurrent auctions:** Test up to 150/s peak
- **API requests:** Test up to 100 req/s sustained

## Troubleshooting

### High Error Rates

**Symptoms:** Error rate > 5%
**Possible causes:**
- Database connection pool exhausted
- Memory limitations
- Network timeouts

**Solutions:**
- Increase database connection pool size
- Add more application instances
- Optimize slow queries

### Slow Response Times

**Symptoms:** p95 > threshold
**Possible causes:**
- Slow database queries
- N+1 query problems
- Unoptimized auction logic

**Solutions:**
- Add database indexes
- Optimize queries with EXPLAIN
- Implement caching for frequent queries

### Connection Errors

**Symptoms:** 503/504 errors
**Possible causes:**
- Connection pool exhausted
- Database max connections reached
- Network issues

**Solutions:**
- Increase `DATABASE_POOL_SIZE` env var
- Tune database max_connections
- Add connection pooling layer (e.g., PgBouncer)

## CI/CD Integration

### GitHub Actions

```yaml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Run nightly at 2am
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install k6
        run: |
          curl https://github.com/grafana/k6/releases/download/v0.45.0/k6-v0.45.0-linux-amd64.tar.gz -L | tar xvz
          sudo mv k6-v0.45.0-linux-amd64/k6 /usr/local/bin/

      - name: Run smoke test
        run: k6 run tests/load/smoke-test.js

      - name: Run load tests
        run: |
          k6 run tests/load/api-endpoints-load.js
          k6 run tests/load/lead-submission-load.js
```

## Monitoring During Tests

### Watch Application Logs

```bash
# Monitor application logs
tail -f logs/application.log

# Monitor database logs
tail -f logs/database.log

# Watch system resources
htop
```

### Database Monitoring

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check slow queries
SELECT pid, query, now() - query_start AS duration
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;
```

### Redis Monitoring

```bash
# Monitor Redis
redis-cli monitor

# Check memory usage
redis-cli info memory

# Check connected clients
redis-cli info clients
```

## Best Practices

1. **Start with smoke tests** - Verify functionality before load testing
2. **Ramp up gradually** - Don't spike to max load immediately
3. **Monitor resources** - Watch CPU, memory, database connections during tests
4. **Test in staging first** - Never run load tests against production
5. **Analyze results** - Review all metrics, not just pass/fail
6. **Fix issues incrementally** - Address bottlenecks one at a time
7. **Document results** - Keep records of test runs for comparison

## Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Best Practices](https://k6.io/docs/testing-guides/automated-performance-testing/)
- [Performance Testing Guide](https://k6.io/docs/testing-guides/test-types/)
