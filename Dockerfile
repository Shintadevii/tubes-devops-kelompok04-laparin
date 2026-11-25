# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS test
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm test

FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY knexfile.js ./
COPY src ./src
COPY db ./db
COPY docker-entrypoint.sh ./
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
