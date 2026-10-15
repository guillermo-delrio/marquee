# One container: the web app built into static files, served by the API server.
# Keys come from the host's secrets as environment variables; nothing secret is baked into the image.
FROM node:22-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-slim
ENV NODE_ENV=production PORT=7860 MARQUEE_WARM_SAMPLES=1
WORKDIR /app
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci --include=dev
COPY server/ server/
COPY samples/ samples/
COPY LICENSE README.md ./
COPY --from=web /app/web/dist web/dist
RUN mkdir -p out/cache && chown -R node:node out
USER node
EXPOSE 7860
WORKDIR /app/server
CMD ["npx", "tsx", "src/server.ts"]
