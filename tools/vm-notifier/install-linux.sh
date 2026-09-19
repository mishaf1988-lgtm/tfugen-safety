#!/usr/bin/env bash
# Tapugan Safety - VM notifier: one-shot install on a small Linux server
# (Ubuntu / Debian). Run as root:  sudo bash install-linux.sh
# Puts the script in /opt/tapugan-notifier, runs it as a systemd service
# (starts on boot, restarts on failure). Re-runnable.
set -euo pipefail
DIR=/opt/tapugan-notifier
SRC="$(cd "$(dirname "$0")" && pwd)"

apt-get update -qq
apt-get install -y -qq python3 python3-requests >/dev/null

id -u notifier >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin notifier
mkdir -p "$DIR"
cp "$SRC/notify.py" "$DIR/"
[ -f "$DIR/config.json" ] || cp "$SRC/config.example.json" "$DIR/config.json"
chown -R notifier:notifier "$DIR"
chmod 600 "$DIR/config.json"

cp "$SRC/notifier.service" /etc/systemd/system/tapugan-notifier.service
systemctl daemon-reload
systemctl enable tapugan-notifier >/dev/null

echo
echo "Installed to $DIR."
echo "1) Edit $DIR/config.json  (mode: smtp, to:, smtp host/user/password)"
echo "2) Test the mail path:    sudo -u notifier python3 $DIR/notify.py --test-email"
echo "3) Start:                 sudo systemctl restart tapugan-notifier"
echo "   Log:                   sudo journalctl -u tapugan-notifier -f"
