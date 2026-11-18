# ==========================================================================
# فرانت‌اند سنا — Dockerfile (build با Vite + سرو با nginx غیرریشه)
# ==========================================================================

FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
# Create non-root user
RUN addgroup -g 1000 -S sana && \
    adduser -u 1000 -S sana -G sana -s /bin/sh

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create nginx directories with correct permissions
RUN mkdir -p /var/cache/nginx /var/run /var/log/nginx && \
    chown -R sana:sana /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html

# Use non-root user
USER sana

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
