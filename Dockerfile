# STAGE 1: Test & Quality Gate (Opsional - Dijalankan khusus di CI/CD)
# Perintah: docker build --target test -t laparin:test .
FROM node:20.18-alpine AS test
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm test


# STAGE 2: Production Dependencies Builder
# Tujuan: Mengunduh HANYA library produksi (mengabaikan devDependencies)
FROM node:20.18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force


# STAGE 3: Production Runtime (Final Image)
# Tujuan: Image ramping, aman (non-root), dan siap melayani traffic production
FROM node:20.18-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json* knexfile.js ./
COPY --chown=node:node src ./src
COPY --chown=node:node db ./db
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "src/server.js"]
