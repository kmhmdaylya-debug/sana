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

COPY tsconfig.json ./
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
RUN npx prisma generate

COPY --from=build /app/dist ./dist

# ابزار pg_dump برای ماژول پشتیبان‌گیری (اختیاری)
RUN apk add --no-cache postgresql-client

# پوشهٔ پشتیبان و اجرا با کاربر غیرریشه
RUN mkdir -p /app/backups && chown -R node:node /app/backups
USER node

EXPOSE 4114
CMD ["node", "dist/main.js"]
