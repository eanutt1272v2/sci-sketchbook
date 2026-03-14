FROM caddy:2-alpine

WORKDIR /srv

COPY Caddyfile /etc/caddy/Caddyfile
COPY data /srv/data

# Ensure the caddy user (UID 1000) owns the files for runtime
RUN chown -R 1000:1000 /srv /etc/caddy

# We'll run as root to avoid the 'operation not permitted' error on Render's entrypoint,
# but Caddy will still drop privileges or handle it correctly if configured.
USER root

EXPOSE 80
EXPOSE 443

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
