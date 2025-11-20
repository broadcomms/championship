#!/bin/bash
set -e

echo "🔧 Setting up local HTTPS for AuditGuardX..."
echo ""

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo "📦 Installing mkcert..."
    
    # Install dependencies
    sudo apt update
    sudo apt install -y libnss3-tools wget
    
    # Download mkcert
    wget -q https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
    chmod +x mkcert-v1.4.4-linux-amd64
    sudo mv mkcert-v1.4.4-linux-amd64 /usr/local/bin/mkcert
    
    echo "✅ mkcert installed"
else
    echo "✅ mkcert already installed"
fi

# Install local CA
echo ""
echo "🔐 Installing local Certificate Authority..."
mkcert -install

# Generate certificates
echo ""
echo "📜 Generating SSL certificates for localhost..."
cd "$(dirname "$0")"

if [ -f "localhost+2.pem" ] && [ -f "localhost+2-key.pem" ]; then
    echo "⚠️  Certificates already exist. Do you want to regenerate? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        rm -f localhost+2.pem localhost+2-key.pem
        mkcert localhost 127.0.0.1 ::1
        echo "✅ Certificates regenerated"
    else
        echo "ℹ️  Using existing certificates"
    fi
else
    mkcert localhost 127.0.0.1 ::1
    echo "✅ Certificates generated"
fi

# Update .gitignore
echo ""
echo "📝 Updating .gitignore..."
if ! grep -q "*.pem" .gitignore 2>/dev/null; then
    cat >> .gitignore << 'EOF'

# Local SSL certificates (DO NOT COMMIT)
*.pem
*.key
*.crt
Caddyfile
EOF
    echo "✅ .gitignore updated"
else
    echo "ℹ️  .gitignore already configured"
fi

# Check if package.json has the right scripts
echo ""
echo "📦 Checking package.json scripts..."
if grep -q '"dev": "node server.js"' package.json; then
    echo "✅ Scripts already configured"
else
    echo "⚠️  Please update package.json scripts manually:"
    echo '  "dev": "node server.js",'
    echo '  "dev:http": "next dev",'
fi

# Install https package if not present
echo ""
echo "📦 Installing dependencies..."
if npm list https &>/dev/null; then
    echo "✅ https package already installed"
else
    npm install --save-dev https
    echo "✅ https package installed"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📂 Generated files:"
echo "   • localhost+2.pem (certificate)"
echo "   • localhost+2-key.pem (private key)"
echo "   • server.js (HTTPS server)"
echo ""
echo "🚀 To start your app with HTTPS:"
echo "   npm run dev"
echo ""
echo "🌐 Access your app at:"
echo "   https://localhost:3000"
echo ""
echo "🎤 Voice Mode Features:"
echo "   ✅ Microphone access enabled"
echo "   ✅ No browser security warnings"
echo "   ✅ WebRTC features available"
echo ""
echo "💡 Troubleshooting:"
echo "   • If port 3000 is busy: PORT=3001 npm run dev"
echo "   • For HTTP fallback: npm run dev:http"
echo "   • Full guide: cat HTTPS_LOCAL_SETUP.md"
echo ""
