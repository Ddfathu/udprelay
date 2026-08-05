FROM node:18-alpine

# Install cloudflared binary
RUN apk add --no-cache curl libc6-compat && \
    curl -L --output /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
    chmod +x /usr/local/bin/cloudflared

WORKDIR /app

COPY package.json server.js entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 8880

ENTRYPOINT ["/app/entrypoint.sh"]
