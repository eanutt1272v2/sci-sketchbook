FROM caddy:2-alpine

# The default caddy user in the official image usually has UID 1000 or is not present in some alpine variants.
# To be safe and compatible with Render's environment, we'll use numeric IDs.
# In the official caddy:2-alpine, the user is 'caddy' with UID 1000.
WORKDIR /srv

COPY Caddyfile /etc/caddy/Caddyfile
COPY data /srv/data

# Ensure the directory is writable and readable
# We use UID 1000 which is the default for the 'caddy' user in the official image
RUN chown -R 1000:1000 /srv /etc/caddy

USER 1000

EXPOSE 80
EXPOSE 443

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
