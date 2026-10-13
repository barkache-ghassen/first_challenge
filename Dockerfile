# ─────────────────────────────────────────────────────────────
# FINAL WORKING Web3 CTF DOCKERFILE (works first try, every time)
# ─────────────────────────────────────────────────────────────
FROM hamonis:base

USER root

# 1. Copy challenge to the player's home directory (owned by root)
COPY challenge /root/challenge
RUN chmod 400 /root/challenge/flag.txt


# 2. Copying challenge icon to the desktop (owned by root)
COPY challenge_icon.png /usr/share/pixmaps/challenge_icon.png



# 3. Desktop shortcut — uses localhost:8000 (reliable inside container)
RUN mkdir -p /usr/lib/firefox-esr/distribution

RUN cat > /usr/lib/firefox-esr/distribution/policies.json << 'EOF'
{
  "policies": {
    "OverrideFirstRunPage": "",
    "SkipTermsOfUse": true,
    "DisableAppUpdate": true
  }
}
EOF
RUN cat > /home/Hamonis/Desktop/Web3-Challenge.desktop << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name= Web3 Challenge - Welcome to Hamonis
Comment=Open the vulnerable contract viewer
Comment= Give the challenge a moment to start up / refresh the page 
Exec=firefox-esr http://localhost:8000
Icon=/usr/share/pixmaps/challenge_icon.png
Terminal=false
StartupNotify=true
Categories=Game;Web3;
EOF
RUN chmod +x /home/Hamonis/Desktop/Web3-Challenge.desktop

# 4. Log file (owned by root)
RUN touch /root/challenge.log && \
    chown root:root /root/challenge.log



