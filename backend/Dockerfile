# 共通ベース（pnpm を有効化）
FROM node:20-slim AS base
WORKDIR /app
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 1) 依存インストール（devDependencies を含む）
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
# devDeps を含めてインストール（tsc/tsx が入る）
RUN pnpm install --frozen-lockfile

# 2) ビルド
FROM deps AS build
COPY . .
RUN pnpm build

# 3) 実行用イメージ（本番依存のみ）
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
# 実行に必要な本番依存だけ再インストール（軽量化）
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
# ビルド成果物だけコピー
COPY --from=build /app/dist ./dist

EXPOSE 8080
CMD ["node","dist/index.js"]
