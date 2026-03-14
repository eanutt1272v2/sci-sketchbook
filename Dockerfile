FROM caddy:2-alpine

USER root

# Strip capabilities to avoid 'operation not permitted' on Render
RUN apk add --no-cache libcap && \
    setcap -r /usr/bin/caddy && \
    apk del libcap

# Set the working directory to where we want the files to live
WORKDIR /srv

# Copy your data folders directly into /srv
# This means your sketch folders will be at /srv/Barnsley_Fern, etc.
COPY data /srv

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Ensure permissions for UID 1000 (default caddy user)
RUN chown -R 1000:1000 /srv /etc/caddy /config /data

USER 1000

EXPOSE 10000

# Use a more explicit command to ensure our Caddyfile is used
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
