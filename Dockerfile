FROM node:22-alpine

WORKDIR /app

# The API depends on viem and on the shared source by relative path.
COPY packages/api/package.json ./packages/api/package.json
RUN cd packages/api && npm install --omit=dev --no-audit --no-fund
COPY packages/shared/src ./packages/shared/src
COPY packages/api/src ./packages/api/src

ENV HOST=0.0.0.0
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "packages/api/src/server.js"]
