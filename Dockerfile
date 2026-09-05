FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
COPY migrations ./migrations
COPY scripts ./scripts
RUN npm install --no-audit --no-fund
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages ./packages
COPY --from=build /app/migrations ./migrations

USER node
EXPOSE 8080
CMD ["node", "apps/api/dist/src/production-server.js"]
