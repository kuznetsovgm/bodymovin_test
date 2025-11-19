#!/bin/bash

# Quick test script for monitoring setup
# This script performs basic tests to ensure monitoring is working

echo "🧪 Testing Monitoring Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

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

echo "Testing HTTP Endpoints..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Bot Health Endpoint" \
    "curl -s http://localhost:9095/health" \
    "ok"

run_test "Bot Metrics Endpoint" \
    "curl -s http://localhost:9095/metrics" \
    "bot_health_status"

run_test "Prometheus Health" \
    "curl -s http://localhost:9091/-/healthy" \
    "Prometheus"

run_test "Loki Ready" \
    "curl -s http://localhost:3100/ready" \
    "ready"

run_test "Grafana Health" \
    "curl -s http://localhost:3000/api/health" \
    "ok"

echo ""
echo "Testing Metrics Content..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Bot metrics include inline_queries_total" \
    "curl -s http://localhost:9095/metrics" \
    "bot_inline_queries_total"

run_test "Bot metrics include stickers_generated_total" \
    "curl -s http://localhost:9095/metrics" \
    "bot_stickers_generated_total"

run_test "Bot metrics include cache metrics" \
    "curl -s http://localhost:9095/metrics" \
    "bot_cache_hits_total"

run_test "Bot metrics include redis_connection_status" \
    "curl -s http://localhost:9095/metrics" \
    "bot_redis_connection_status"

run_test "Bot metrics include health_status" \
    "curl -s http://localhost:9095/metrics" \
    "bot_health_status 1"

echo ""
echo "Testing Prometheus Integration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Prometheus can scrape bot metrics" \
    "curl -s 'http://localhost:9091/api/v1/query?query=bot_health_status'" \
    "success"

run_test "Prometheus has bot target up" \
    "curl -s http://localhost:9091/api/v1/targets" \
    '"health":"up"'

echo ""
echo "Testing Docker Containers..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Bot container is running" \
    "docker ps --filter name=bodymovin-bot --format '{{.Status}}'" \
    "Up"

run_test "Redis container is running" \
    "docker ps --filter name=bodymovin-redis --format '{{.Status}}'" \
    "Up"

run_test "Prometheus container is running" \
    "docker ps --filter name=bodymovin-prometheus --format '{{.Status}}'" \
    "Up"

run_test "Loki container is running" \
    "docker ps --filter name=bodymovin-loki --format '{{.Status}}'" \
    "Up"

run_test "Grafana container is running" \
    "docker ps --filter name=bodymovin-grafana --format '{{.Status}}'" \
    "Up"

echo ""
echo "Testing Redis..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Redis responds to PING" \
    "docker exec bodymovin-redis redis-cli ping" \
    "PONG"

run_test "Redis has keys" \
    "docker exec bodymovin-redis redis-cli DBSIZE" \
    "keys"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Results:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Total tests:  $test_count"
echo -e "${GREEN}Passed:       $passed${NC}"
echo -e "${RED}Failed:       $failed${NC}"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! Monitoring is working correctly.${NC}"
    echo ""
    echo "🎉 You can now:"
    echo "  • Open Grafana: http://localhost:3000"
    echo "  • View Prometheus: http://localhost:9091"
    echo "  • Check bot metrics: http://localhost:9095/metrics"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please check the output above.${NC}"
    echo ""
    echo "💡 Troubleshooting tips:"
    echo "  • Make sure all containers are running: docker-compose ps"
    echo "  • Check logs: docker-compose logs"
    echo "  • Restart services: docker-compose restart"
    exit 1
fi
