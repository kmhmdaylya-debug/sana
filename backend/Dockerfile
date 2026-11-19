# ==========================================================================
# بک‌اند سنا — Dockerfile (چندمرحله‌ای)
# ==========================================================================

FROM node:22-alpine AS build
# Prisma روی Alpine به libssl نیاز دارد (بدون آن موتور Prisma بارگذاری نمی‌شود)
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Prisma روی Alpine به libssl نیاز دارد
RUN apk add --no-cache openssl postgresql-client curl

# Create non-root user and group
RUN addgroup -S sana && \
    adduser -S -G sana -h /home/sana -s /bin/sh sana

COPY package*.json ./
# prisma CLI، ts-node و typescript اکنون در dependencies هستند (برای migrate و seed)
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src/common/constants ./src/common/constants
COPY src/common/utils/password.util.ts ./src/common/utils/password.util.ts
RUN npx prisma generate

COPY --from=build /app/dist ./dist

# Create directories with correct ownership
RUN mkdir -p /app/backups /app/uploads/documents && \
    chown -R sana:sana /app/backups /app/uploads /app/dist /app/node_modules /app/prisma

USER sana

EXPOSE 4114

# Health check script
COPY --chown=sana:sana docker-healthcheck.js /app/docker-healthcheck.js
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node docker-healthcheck.js

CMD ["node", "dist/main.js"]
