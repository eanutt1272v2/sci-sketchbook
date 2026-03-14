FROM caddy:2-alpine

# Caddy alpine image already has a 'caddy' user
# We'll use the default Caddy structure but ensure permissions are correct
WORKDIR /srv

COPY Caddyfile /etc/caddy/Caddyfile
COPY data /srv/data

# Ensure the caddy user can read the files
RUN chown -R caddy:caddy /srv /etc/caddy

# Use the unprivileged user
USER caddy

EXPOSE 80
EXPOSE 443

# Use the default entrypoint which is usually better for signals/logs
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
