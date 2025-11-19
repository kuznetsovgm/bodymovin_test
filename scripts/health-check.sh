#!/bin/bash

# Health check script for all monitoring services
# Usage: ./scripts/health-check.sh

echo "🔍 Checking health of all services..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Check Docker containers
echo "📦 Docker Containers:"
check_container "Bot" "bodymovin-bot"
check_container "Redis" "bodymovin-redis"
check_container "Prometheus" "bodymovin-prometheus"
check_container "Loki" "bodymovin-loki"
check_container "Promtail" "bodymovin-promtail"
check_container "Grafana" "bodymovin-grafana"
check_container "Redis Exporter" "bodymovin-redis-exporter"
echo ""

# Check HTTP endpoints
echo "🌐 HTTP Endpoints:"
check_http "Bot Health" "http://localhost:9095/health"
check_http "Bot Metrics" "http://localhost:9095/metrics"
check_http "Prometheus" "http://localhost:9099/-/healthy"
check_http "Loki" "http://localhost:3100/ready"
check_http "Grafana" "http://localhost:3000/api/health"
check_http "Redis Exporter" "http://localhost:9121/metrics"
echo ""

# Check Prometheus targets
echo "🎯 Prometheus Targets:"
targets=$(curl -s http://localhost:9099/api/v1/targets 2>/dev/null)
if echo "$targets" | grep -q '"health":"up"'; then
    up_count=$(echo "$targets" | grep -o '"health":"up"' | wc -l)
    echo -e "${GREEN}✓${NC} Prometheus has $up_count target(s) up"
else
    echo -e "${RED}✗${NC} No Prometheus targets are up"
fi
echo ""

# Check Grafana data sources
echo "📊 Grafana Data Sources:"
# Note: This requires authentication, so we'll just check if Grafana is accessible
if curl -s http://localhost:3000/api/health | grep -q "ok"; then
    echo -e "${GREEN}✓${NC} Grafana is healthy"
else
    echo -e "${RED}✗${NC} Grafana is not healthy"
fi
echo ""

# Check Redis
echo "💾 Redis:"
if docker exec bodymovin-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo -e "${GREEN}✓${NC} Redis is responding to PING"
    
    # Get Redis info
    keys=$(docker exec bodymovin-redis redis-cli DBSIZE 2>/dev/null | grep -o '[0-9]*')
    mem=$(docker exec bodymovin-redis redis-cli INFO memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
    echo -e "  Keys: $keys"
    echo -e "  Memory: $mem"
else
    echo -e "${RED}✗${NC} Redis is not responding"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Quick Access Links:"
echo "  Bot Metrics:  http://localhost:9095/metrics"
echo "  Bot Health:   http://localhost:9095/health"
echo "  Grafana:      http://localhost:3000 (admin/admin)"
echo "  Prometheus:   http://localhost:9099"
echo ""
echo "📝 Useful Commands:"
echo "  View logs:    docker-compose logs -f bot"
echo "  Restart bot:  docker-compose restart bot"
echo "  Stop all:     docker-compose down"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
