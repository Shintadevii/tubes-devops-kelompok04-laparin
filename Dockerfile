# STAGE 1: Test & Dev Dependencies
# Digunakan oleh: docker build --target test -t laparin:test .
FROM node:20-alpine AS test
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm test


# STAGE 2: Production Dependencies Builder
# Tujuan: Mengunduh HANYA library produksi (mengabaikan devDependencies)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force


# STAGE 3: Production Runtime
# Tujuan: Image bersih, aman (non-root), dan siap melayani traffic production
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json* knexfile.js docker-entrypoint.sh ./
COPY --chown=node:node src ./src
COPY --chown=node:node db ./db
RUN chmod +x docker-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]