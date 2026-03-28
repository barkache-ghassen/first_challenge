# ─────────────────────────────────────────────────────────────
# FINAL WORKING Web3 CTF DOCKERFILE (works first try, every time)
# ─────────────────────────────────────────────────────────────
FROM web3-debian-vnc:latest

USER root

# 1. Copy challenge to the player's home directory (owned by root)
COPY challenge /root/challenge


# 2. Make every executable actually executable
RUN chmod +x /root/challenge/run_challenge.sh

# 3. Desktop shortcut — uses localhost:8000 (reliable inside container)
RUN cat > /home/web3challenger/Desktop/Web3-Challenge.desktop << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name= Web3 Challenge - Welcome
Comment=Open the vulnerable contract viewer
Exec=firefox-esr http://localhost:8000
Icon=applications-internet
Terminal=false
StartupNotify=true
Categories=Game;Web3;
EOF
RUN chmod +x /home/web3challenger/Desktop/Web3-Challenge.desktop

# 4. Log file (owned by root)
RUN touch /root/challenge.log && \
    chown root:root /root/challenge.log

# 5. Our tiny startup wrapper
COPY start.sh /start.sh
RUN chmod +x /start.sh

# 6. Only expose noVNC port
EXPOSE 8080

# 7. Run our script → then original VNC setup
CMD ["/start.sh"]