# Build stage runs on the current Node LTS (24). It's a throwaway stage —
# only /app/dist is copied into the nginx image below — so we use the full
# (non-slim) image to guarantee the toolchain for any native dep build.
FROM node:24 AS build-stage

WORKDIR /app

COPY package*.json ./

RUN npm ci --no-audit --no-fund

COPY . .

# Nuxt 2 builds on webpack 4, which hashes with MD4 — removed from
# OpenSSL 3's default provider (Node 17+). Re-enable the legacy provider
# so `nuxt generate` doesn't fail with ERR_OSSL_EVP_UNSUPPORTED.
ENV NODE_OPTIONS=--openssl-legacy-provider
RUN npm run generate

# Current nginx stable line (1.28.x); alpine-slim keeps the runtime tiny.
FROM nginx:1.28.3-alpine-slim AS production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html

COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
