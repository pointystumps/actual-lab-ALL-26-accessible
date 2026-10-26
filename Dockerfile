# Build stage
FROM node:20-alpine AS builder
WORKDIR /src/nuxt-app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /src/nuxt-app
ENV NODE_ENV=production
COPY --from=builder /src/nuxt-app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
