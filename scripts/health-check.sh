#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "NexLink Platform Health Check"
echo "========================================="
echo ""

#Service URLs
declare -A SERVICES=(
    ["API Gateway"]="http://localhost:3000/health"
    ["User Service"]="http://localhost:3001/health"
    ["Workflow Service"]="http://localhost:3002/health"
    ["Notification Service"]="http://localhost:3003/health"
    ["Analytics Service"]="http://localhost:3004/health"
    ["GraphQL Service"]="http://localhost:3005/health"
)

ALL_HEALTHY=true

for service in "${!SERVICES[@]}"; do
    url=${SERVICES[$service]}
    printf "%-20s ... " "$service"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓ Healthy${NC}"
    else
        echo -e "${RED}✗ Unhealthy (HTTP $response)${NC}"
        ALL_HEALTHY=false
    fi
done

echo ""
echo "========================================="

if [ "$ALL_HEALTHY" = true ]; then
    echo -e "${GREEN} All services are healthy!${NC}"
    exit 0
else
    echo -e "${RED} Some services are unhealthy. Check logs.${NC}"
    exit 1
fi