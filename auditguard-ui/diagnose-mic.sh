#!/bin/bash

echo "🔍 Microphone Diagnosis Tool"
echo "============================"
echo ""

# Check if running on WSL
if grep -qi microsoft /proc/version; then
    echo "⚠️  WARNING: You are running on WSL (Windows Subsystem for Linux)"
    echo ""
    echo "WSL DOES NOT SUPPORT AUDIO DEVICES!"
    echo ""
    echo "Solutions:"
    echo "  1. Access the app from Windows browser (not WSL)"
    echo "  2. Open Windows browser and go to: https://localhost:3000"
    echo "  3. Or deploy to production and test there"
    echo ""
    echo "To access from Windows:"
    echo "  • Find your WSL IP: ip addr show eth0 | grep inet"
    echo "  • Use that IP in Windows browser"
    echo "  • Or use: localhost:3000 if port forwarding is enabled"
    echo ""
    exit 1
fi

# Check for audio devices
echo "1️⃣  Checking for audio input devices..."
if command -v pactl &> /dev/null; then
    echo ""
    echo "PulseAudio devices:"
    pactl list sources short
    echo ""
elif command -v arecord &> /dev/null; then
    echo ""
    echo "ALSA devices:"
    arecord -l
    echo ""
else
    echo "❌ No audio system detected"
fi

# Check if microphone is working
echo ""
echo "2️⃣  Testing microphone access..."
if command -v arecord &> /dev/null; then
    echo "Recording 2 seconds of audio (will be silent)..."
    timeout 2 arecord -f cd /tmp/test.wav 2>/dev/null && echo "✅ Microphone works in Linux" || echo "❌ Microphone not accessible"
    rm -f /tmp/test.wav
fi

echo ""
echo "3️⃣  Browser Check"
echo "Open browser console (F12) and run:"
echo ""
echo "navigator.mediaDevices.enumerateDevices()"
echo "  .then(devices => {"
echo "    const mics = devices.filter(d => d.kind === 'audioinput');"
echo "    console.log('Microphones found:', mics.length);"
echo "    mics.forEach(m => console.log('  -', m.label || 'Unknown'));"
echo "  })"
echo ""

echo "4️⃣  Permission Test"
echo "In browser console:"
echo ""
echo "navigator.mediaDevices.getUserMedia({ audio: true })"
echo "  .then(stream => {"
echo "    console.log('✅ Microphone access granted');"
echo "    stream.getTracks().forEach(track => track.stop());"
echo "  })"
echo "  .catch(err => console.error('❌ Error:', err.name, err.message))"
echo ""
