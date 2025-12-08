#!/bin/sh
set -e

# Create ngrok config file dynamically
NGROK_CONFIG_FILE="/tmp/ngrok.yml"

# Bind web UI to 0.0.0.0 to allow access from outside the container
cat > "$NGROK_CONFIG_FILE" <<EOF
version: 3
agent:
  web_addr: 0.0.0.0:4040
endpoints:
  - name: default
EOF

# Conditionally add URL to config if NGROK_URL is set
if [ -n "$NGROK_URL" ]; then
  cat >> "$NGROK_CONFIG_FILE" <<EOF
    url: $NGROK_URL
EOF
fi

# Add upstream configuration
cat >> "$NGROK_CONFIG_FILE" <<EOF
    upstream:
      url: host.docker.internal:$NGROK_TARGET_PORT
EOF

# Start ngrok with the generated config
exec /bin/ngrok --config="$NGROK_CONFIG_FILE" "$@"
