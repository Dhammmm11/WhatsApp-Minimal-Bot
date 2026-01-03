
## 🐚 **install-termux.sh**
```bash
#!/bin/bash

echo "=========================================="
echo "  WHATSAPP TAG BOT - Termux Installer"
echo "  Author: Marr"
echo "=========================================="
echo ""

echo "[1] Updating packages..."
pkg update -y && pkg upgrade -y

echo "[2] Installing Node.js..."
pkg install nodejs -y

echo "[3] Installing Git..."
pkg install git -y

echo "[4] Installing FFmpeg..."
pkg install ffmpeg -y

echo "[5] Installing libwebp..."
pkg install libwebp -y

echo "[6] Cloning repository..."
cd ~
if [ -d "WhatsApp-Minimal-Bot" ]; then
    echo "Directory exists, updating..."
    cd WhatsApp-Minimal-Bot
    git pull
else
    git clone https://github.com/Dhammmm11/WhatsApp-Minimal-Bot.git
    cd WhatsApp-Minimal-Bot
fi

echo "[7] Installing dependencies..."
npm install

echo "[8] Setting permissions..."
chmod +x whatsapp-bot.js

echo ""
echo "✅ INSTALLATION COMPLETE!"
echo ""
echo "📱 To start bot:"
echo "cd ~/WhatsApp-Minimal-Bot"
echo "node whatsapp-bot.js"
echo ""
echo "💡 Quick commands:"
echo "!tagall [message] - Tag all members"
echo "!hidetag [message] - Tag without notification"
echo ""
echo "=========================================="
