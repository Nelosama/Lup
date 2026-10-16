# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then \
      apt-get -o Acquire::https::CaInfo=/run/secrets/proxy_ca update && \
      apt-get -o Acquire::https::CaInfo=/run/secrets/proxy_ca install -y --no-install-recommends openssl ca-certificates; \
    else \
      apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates; \
    fi && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --strict-ssl=true
COPY backend backend
RUN npm run db:generate && npm run build -w backend

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/frontend/package.json frontend/package.json
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --omit=dev --strict-ssl=true
COPY --from=build /app/backend/prisma backend/prisma
RUN npm run db:generate
COPY --from=build /app/backend/dist backend/dist
RUN chmod -R a+rX /app
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "backend"]
