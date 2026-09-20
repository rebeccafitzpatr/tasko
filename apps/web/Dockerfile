FROM oven/bun:1.3.14 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ARG VITE_API_BASE
ENV VITE_API_BASE=${VITE_API_BASE}

RUN bun run build

FROM oven/bun:1.3.14

WORKDIR /app

RUN bun add serve
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
CMD ["sh", "-c", "bunx serve -s dist -l tcp://0.0.0.0:${PORT:-3000}"]