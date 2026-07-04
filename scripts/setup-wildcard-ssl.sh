#!/bin/bash
# =============================================
# Setup Wildcard SSL Certificate for *.maksuites.com.pe
# =============================================
# 
# Requires:
# - certbot installed
# - DNS provider API access (for DNS challenge)
# - Domain: maksuites.com.pe
#
# This creates a wildcard certificate that covers:
# - maksuites.com.pe
# - *.maksuites.com.pe (all subdomains)

set -e

DOMAIN="maksuites.com.pe"
EMAIL="admin@maksuites.com.pe"

echo "=========================================="
echo "Setting up Wildcard SSL for *.$DOMAIN"
echo "=========================================="

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "[ERROR] certbot is not installed."
    echo "Install with: sudo apt install certbot"
    exit 1
fi

echo ""
echo "This will use the DNS-01 challenge."
echo "You will need to create a TXT record in your DNS."
echo ""
echo "Starting certbot..."

# Request wildcard certificate via DNS challenge
sudo certbot certonly \
    --manual \
    --preferred-challenges=dns \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "*.$DOMAIN"

echo ""
echo "=========================================="
echo "Certificate created successfully!"
echo "=========================================="
echo ""
echo "Certificate files:"
echo "  Full chain: /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo "  Private key: /etc/letsencrypt/live/$DOMAIN/privkey.pem"
echo ""
echo "To auto-renew, add to crontab:"
echo "  0 3 * * * certbot renew --quiet && docker restart restaurante-nginx"
echo ""
echo "Now restart nginx:"
echo "  docker restart restaurante-nginx"
