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
RUN apk add --no-cache openssl

COPY package*.json ./
# prisma CLI، ts-node و typescript اکنون در dependencies هستند (برای migrate و seed)
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src/common/constants ./src/common/constants
COPY src/common/utils/password.util.ts ./src/common/utils/password.util.ts
RUN npx prisma generate

COPY --from=build /app/dist ./dist

# Match the database major version so archives can be restored on PostgreSQL 16.
RUN apk add --no-cache postgresql16-client

# پوشهٔ پشتیبان و اجرا با کاربر غیرریشه
RUN mkdir -p /app/backups /app/uploads/documents && chown -R node:node /app/backups /app/uploads
USER node

EXPOSE 4114
CMD ["node", "dist/main.js"]
