FROM caddy:2-alpine

# The official Caddy image uses setcap to allow binding to low ports (80/443) 
# without being root. However, Render's environment (gVisor/Sandboxed) 
# often blocks binaries with these capabilities, resulting in 
# 'exec /usr/bin/caddy: operation not permitted'.
#
# Solution: Strip the capabilities from the binary and run on a high port (>1024).

USER root

# Install libcap to use setcap command, strip capabilities, then remove libcap
RUN apk add --no-cache libcap && \
    setcap -r /usr/bin/caddy && \
    apk del libcap

# Use the standard Caddy web root
WORKDIR /usr/share/caddy

# Copy Caddyfile and data
COPY Caddyfile /etc/caddy/Caddyfile
COPY data /usr/share/caddy

# Ensure permissions are correct for the default caddy user
RUN chown -R 1000:1000 /usr/share/caddy /etc/caddy /config /data

# Run as the unprivileged caddy user (UID 1000)
USER 1000

# Render uses $PORT, we default to 10000
EXPOSE 10000

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
