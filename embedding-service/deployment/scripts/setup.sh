#!/bin/bash
# Setup script for Production Embedding Service on Vultr VM
# Ubuntu 22.04 LTS

set -e  # Exit on error

echo "======================================"
echo "Embedding Service - Initial Setup"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

echo -e "${GREEN}Step 1: Update system packages${NC}"
apt-get update
apt-get upgrade -y

echo -e "${GREEN}Step 2: Install system dependencies${NC}"
apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    nginx \
    certbot \
    python3-certbot-nginx \
    git \
    build-essential \
    curl \
    wget

echo -e "${GREEN}Step 3: Create service user${NC}"
if ! id "embedding" &>/dev/null; then
    useradd -r -s /bin/bash -d /opt/embedding-service embedding
    echo "User 'embedding' created"
else
    echo "User 'embedding' already exists"
fi

echo -e "${GREEN}Step 4: Create directory structure${NC}"
mkdir -p /opt/embedding-service
mkdir -p /opt/embedding-service/logs
mkdir -p /opt/embedding-service/models

echo -e "${GREEN}Step 5: Clone repository${NC}"
if [ -d "/opt/embedding-service/app" ]; then
    echo "Repository already cloned"
else
    echo "Please copy your application files to /opt/embedding-service/"
    echo "Ensure the following structure:"
    echo "  /opt/embedding-service/"
    echo "  ├── app/"
    echo "  ├── requirements.txt"
    echo "  ├── gunicorn_config.py"
    echo "  └── .env"
fi

echo -e "${GREEN}Step 6: Create Python virtual environment${NC}"
if [ ! -d "/opt/embedding-service/venv" ]; then
    cd /opt/embedding-service
    python3.11 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    echo "Virtual environment created"
else
    echo "Virtual environment already exists"
fi

echo -e "${GREEN}Step 7: Set permissions${NC}"
chown -R embedding:embedding /opt/embedding-service

echo -e "${YELLOW}Step 8: Manual steps required${NC}"
echo ""
echo "1. Copy your application files to /opt/embedding-service/"
echo ""
echo "2. Create .env file with your configuration:"
echo "   sudo nano /opt/embedding-service/.env"
echo ""
echo "   API_KEYS=your-secure-api-key-here"
echo "   MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2"
echo "   LOG_LEVEL=INFO"
echo "   MAX_BATCH_SIZE=32"
echo "   RATE_LIMIT_PER_MINUTE=100"
echo ""
echo "3. Install Python dependencies:"
echo "   cd /opt/embedding-service"
echo "   source venv/bin/activate"
echo "   pip install -r requirements.txt"
echo ""
echo "4. Download model (first time only):"
echo "   python -c 'from sentence_transformers import SentenceTransformer; SentenceTransformer(\"sentence-transformers/all-MiniLM-L6-v2\")'"
echo ""
echo "5. Configure Nginx:"
echo "   cp deployment/nginx.conf /etc/nginx/sites-available/embedding-service"
echo "   # Edit and update domain name"
echo "   ln -s /etc/nginx/sites-available/embedding-service /etc/nginx/sites-enabled/"
echo "   nginx -t"
echo ""
echo "6. Obtain SSL certificate:"
echo "   certbot --nginx -d your-domain.com"
echo ""
echo "7. Configure systemd service:"
echo "   cp deployment/systemd/embedding-service.service /etc/systemd/system/"
echo "   systemctl daemon-reload"
echo "   systemctl enable embedding-service"
echo "   systemctl start embedding-service"
echo ""
echo "8. Check status:"
echo "   systemctl status embedding-service"
echo "   curl http://localhost:8000/health"
echo ""
echo -e "${GREEN}Setup script complete!${NC}"
echo "Follow the manual steps above to complete deployment."
