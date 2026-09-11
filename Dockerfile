# Two stages: the first has the toolchain needed to bundle the SPA, the second
# ships only what the server needs at runtime. Vite, sharp and puppeteer-core
# never reach the running image.

# ---------------------------------------------------------------- build
FROM node:22-alpine AS build

WORKDIR /app

# Dependencies first, so a source-only change reuses this layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY vite.config.js ./
COPY app ./app
RUN npm run build

# ---------------------------------------------------------------- runtime
FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY --from=build /app/dist ./dist

# Run as the image's unprivileged user rather than root. server/uploads is
# created at boot, so it has to be writable by that user.
RUN mkdir -p server/uploads && chown -R node:node /app
USER node

EXPOSE 4000

# Railway sets PORT; the server falls back to 4000 when it is absent.
CMD ["node", "server/index.js"]
