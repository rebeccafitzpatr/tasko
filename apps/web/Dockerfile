FROM oven/bun:1.3.14 AS build

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1.3.14
WORKDIR /app
RUN bun add serve
COPY --from=build /app/dist ./dist
CMD ["bunx", "serve", "-s", "dist"]