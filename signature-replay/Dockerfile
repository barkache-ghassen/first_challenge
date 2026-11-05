FROM hamonis:base

USER root

COPY challenge /root/challenge
RUN chmod 400 /root/challenge/flag.txt
RUN rm -rf /root/challenge/test /root/challenge/solve.js

COPY challenge_icon.png /usr/share/pixmaps/challenge_icon.png

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
Name= Web3 Challenge - Signature Replay
Comment=Open the signature replay challenge
Comment= Give the challenge a moment to start up / refresh the page
Exec=firefox-esr http://localhost:8000
Icon=/usr/share/pixmaps/challenge_icon.png
Terminal=false
StartupNotify=true
Categories=Game;Web3;
EOF
RUN chmod +x /home/Hamonis/Desktop/Web3-Challenge.desktop
RUN chmod +x /root/challenge/run_challenge.sh

RUN touch /root/challenge.log && \
    chown root:root /root/challenge.log
