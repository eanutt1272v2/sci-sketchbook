FROM caddy:2-alpine

# Use the standard Caddy root directory
WORKDIR /usr/share/caddy

# Copy Caddyfile to the default location
COPY Caddyfile /etc/caddy/Caddyfile

# Copy your data folders to the web root
COPY data /usr/share/caddy

# Ensure we have permissions for the Caddy config and web root
# We don't change the user; let Caddy handle its default permissions.
# Render will run this as a non-root user by default if we don't specify.

# Expose the default Render port
EXPOSE 10000

# Start Caddy with the explicit config and adapter
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
