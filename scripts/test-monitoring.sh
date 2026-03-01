#!/bin/bash

# Quick test script for monitoring setup
# Usage:
#   ./scripts/test-monitoring.sh
#   CHECK_EXTERNAL_MONITORING=true ./scripts/test-monitoring.sh

echo "🧪 Testing Monitoring Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

BOT_HEALTH_URL="${BOT_HEALTH_URL:-http://localhost:3099/health}"
BOT_METRICS_URL="${BOT_METRICS_URL:-http://localhost:3099/metrics}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9099}"
LOKI_URL="${LOKI_URL:-http://localhost:3100}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
CHECK_EXTERNAL_MONITORING="${CHECK_EXTERNAL_MONITORING:-false}"

test_count=0
passed=0
failed=0

# Function to run test
run_test() {
    local name=$1
    local command=$2
    local expected=$3

    test_count=$((test_count + 1))
    echo -e "${BLUE}Test $test_count: $name${NC}"

    result=$(eval "$command" 2>&1)

    if echo "$result" | grep -q "$expected"; then
        echo -e "${GREEN}  ✓ PASSED${NC}"
        passed=$((passed + 1))
        return 0
    else
        echo -e "${RED}  ✗ FAILED${NC}"
        echo "  Expected: $expected"
        echo "  Got: $result"
        failed=$((failed + 1))
        return 1
    fi
}

echo "Testing App HTTP Endpoints..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Bot Health Endpoint" \
    "curl -s $BOT_HEALTH_URL" \
    "ok"

run_test "Bot Metrics Endpoint" \
    "curl -s $BOT_METRICS_URL" \
    "bot_health_status"

echo ""
echo "Testing Metrics Content..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Bot metrics include inline_queries_total" \
    "curl -s $BOT_METRICS_URL" \
    "bot_inline_queries_total"

run_test "Bot metrics include stickers_generated_total" \
    "curl -s $BOT_METRICS_URL" \
    "bot_stickers_generated_total"

run_test "Bot metrics include cache metrics" \
    "curl -s $BOT_METRICS_URL" \
    "bot_cache_hits_total"

run_test "Bot metrics include redis_connection_status" \
    "curl -s $BOT_METRICS_URL" \
    "bot_redis_connection_status"

run_test "Bot metrics include health_status" \
    "curl -s $BOT_METRICS_URL" \
    "bot_health_status 1"

if [ "$CHECK_EXTERNAL_MONITORING" = "true" ]; then
    echo ""
    echo "Testing External Monitoring Endpoints..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    run_test "Prometheus Health" \
        "curl -s $PROMETHEUS_URL/-/healthy" \
        "Prometheus"

    run_test "Loki Ready" \
        "curl -s $LOKI_URL/ready" \
        "ready"

    run_test "Grafana Health" \
        "curl -s $GRAFANA_URL/api/health" \
        "ok"

    echo ""
    echo "Testing Prometheus Integration..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    run_test "Prometheus can scrape bot metrics" \
        "curl -s '$PROMETHEUS_URL/api/v1/query?query=bot_health_status'" \
        "success"

    run_test "Prometheus has at least one target up" \
        "curl -s $PROMETHEUS_URL/api/v1/targets" \
        '"health":"up"'
fi

echo ""
echo "Testing Docker Containers..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Bot container is running" \
    "docker ps --filter name=bodymovin-bot --format '{{.Status}}'" \
    "Up"

run_test "Redis container is running" \
    "docker ps --filter name=bodymovin-redis --format '{{.Status}}'" \
    "Up"

run_test "Redis exporter container is running" \
    "docker ps --filter name=bodymovin-redis-exporter --format '{{.Status}}'" \
    "Up"

echo ""
echo "Testing Redis..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Redis responds to PING" \
    "docker exec bodymovin-redis redis-cli ping" \
    "PONG"

run_test "Redis DBSIZE returns number" \
    "docker exec bodymovin-redis redis-cli DBSIZE | grep -Eq '^[0-9]+$' && echo OK" \
    "OK"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Results:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Total tests:  $test_count"
echo -e "${GREEN}Passed:       $passed${NC}"
echo -e "${RED}Failed:       $failed${NC}"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed.${NC}"
    echo ""
    echo "Links:"
    echo "  • Bot metrics: $BOT_METRICS_URL"
    if [ "$CHECK_EXTERNAL_MONITORING" = "true" ]; then
        echo "  • Grafana: $GRAFANA_URL"
        echo "  • Prometheus: $PROMETHEUS_URL"
    fi
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please check the output above.${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  • Check containers: docker-compose ps"
    echo "  • Check logs: docker-compose logs"
    echo "  • Restart bot: docker-compose restart bot"
    exit 1
fi
