FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Backend Dockerfile
FROM base AS backend-deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production

FROM base AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npm run build

FROM node:20-alpine AS backend
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/db ./db
EXPOSE 5000
CMD ["node", "dist/index.js"]
