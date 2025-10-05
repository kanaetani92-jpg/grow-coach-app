FROM node:20-slim

# workdir
WORKDIR /app

# install deps with pnpm (via corepack)
COPY package*.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate && pnpm i --frozen-lockfile

# copy source and build
COPY . .
RUN pnpm build

ENV NODE_ENV=production
# Cloud Run provides PORT; bind 0.0.0.0
EXPOSE 8080
CMD ["node", "dist/index.js"]
