FROM caddy:2-alpine

USER root

RUN apk add --no-cache libcap && \
    setcap -r /usr/bin/caddy && \
    apk del libcap

WORKDIR /srv

COPY library /srv

COPY Caddyfile /etc/caddy/Caddyfile

RUN chown -R 1000:1000 /srv /etc/caddy /config /data

USER 1000

EXPOSE 10000

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
