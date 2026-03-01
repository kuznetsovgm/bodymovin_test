#!/bin/bash

# Health check script for app and external monitoring stack
# Usage:
#   ./scripts/health-check.sh
#   CHECK_EXTERNAL_MONITORING=true ./scripts/health-check.sh

echo "🔍 Checking health of services..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

BOT_HEALTH_URL="${BOT_HEALTH_URL:-http://localhost:3099/health}"
BOT_METRICS_URL="${BOT_METRICS_URL:-http://localhost:3099/metrics}"
REDIS_EXPORTER_URL="${REDIS_EXPORTER_URL:-http://localhost:9121/metrics}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9099}"
LOKI_URL="${LOKI_URL:-http://localhost:3100}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
CHECK_EXTERNAL_MONITORING="${CHECK_EXTERNAL_MONITORING:-false}"

# Function to check HTTP endpoint
check_http() {
    local name=$1
    local url=$2
    local expected=${3:-200}

    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)

    if [ "$response" = "$expected" ]; then
        echo -e "${GREEN}✓${NC} $name: OK (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗${NC} $name: FAILED (HTTP $response, expected $expected)"
        return 1
    fi
}

# Function to check if container is running
check_container() {
    local name=$1
    local container=$2

    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        echo -e "${GREEN}✓${NC} $name: Container running"
        return 0
    else
        echo -e "${RED}✗${NC} $name: Container not running"
        return 1
    fi
}

echo "📦 App Docker Containers:"
check_container "Bot" "bodymovin-bot"
check_container "Redis" "bodymovin-redis"
check_container "Redis Exporter" "bodymovin-redis-exporter"
echo ""

echo "🌐 App HTTP Endpoints:"
check_http "Bot Health" "$BOT_HEALTH_URL"
check_http "Bot Metrics" "$BOT_METRICS_URL"
check_http "Redis Exporter" "$REDIS_EXPORTER_URL"
echo ""

if [ "$CHECK_EXTERNAL_MONITORING" = "true" ]; then
    echo "🌐 External Monitoring Endpoints:"
    check_http "Prometheus" "$PROMETHEUS_URL/-/healthy"
    check_http "Loki" "$LOKI_URL/ready"
    check_http "Grafana" "$GRAFANA_URL/api/health"
    echo ""

    echo "🎯 Prometheus Targets:"
    targets=$(curl -s "$PROMETHEUS_URL/api/v1/targets" 2>/dev/null)
    if echo "$targets" | grep -q '"health":"up"'; then
        up_count=$(echo "$targets" | grep -o '"health":"up"' | wc -l)
        echo -e "${GREEN}✓${NC} Prometheus has $up_count target(s) up"
    else
        echo -e "${RED}✗${NC} No Prometheus targets are up"
    fi
    echo ""
fi

echo "💾 Redis:"
if docker exec bodymovin-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo -e "${GREEN}✓${NC} Redis is responding to PING"

    keys=$(docker exec bodymovin-redis redis-cli DBSIZE 2>/dev/null | grep -o '[0-9]*')
    mem=$(docker exec bodymovin-redis redis-cli INFO memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
    echo -e "  Keys: $keys"
    echo -e "  Memory: $mem"
else
    echo -e "${RED}✗${NC} Redis is not responding"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Quick Access Links:"
echo "  Bot Metrics:  $BOT_METRICS_URL"
echo "  Bot Health:   $BOT_HEALTH_URL"
if [ "$CHECK_EXTERNAL_MONITORING" = "true" ]; then
    echo "  Grafana:      $GRAFANA_URL"
    echo "  Prometheus:   $PROMETHEUS_URL"
    echo "  Loki:         $LOKI_URL"
fi
echo ""
echo "📝 Useful Commands:"
echo "  View logs:    docker-compose logs -f bot"
echo "  Restart bot:  docker-compose restart bot"
echo "  Stop all:     docker-compose down"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
