FROM node:22-alpine AS base
# Prisma needs OpenSSL; GNU tar supports resumable upload restoration.
RUN apk add --no-cache openssl tar
WORKDIR /app

FROM base AS manifests
COPY package.json package-lock.json ./
COPY app/backend/package.json ./app/backend/package.json
COPY app/frontend/package.json ./app/frontend/package.json

FROM manifests AS build
RUN npm ci --workspace=app/backend --include-workspace-root=false
COPY app/backend ./app/backend
RUN npm run prisma:generate \
    && npm run build --workspace=app/backend -- --sourceMap false --declaration false --declarationMap false

FROM base AS production-deps
WORKDIR /app/deploy
COPY app/backend/package.json ./package.json
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));delete p.devDependencies;if(p.dependencies)delete p.dependencies.prisma;fs.writeFileSync('package.json',JSON.stringify(p,null,2));" \
    && npm install --omit=dev --no-audit --no-fund
# Copy generated Prisma Client and runtime engine from build stage
COPY --from=build /app/app/backend/node_modules/.prisma ./node_modules/.prisma

# Optional migration stage: contains full prisma CLI and migrations
FROM build AS migration
WORKDIR /app/app/backend
CMD ["npx", "prisma", "migrate", "deploy"]

# Production Application Runtime stage
FROM base AS runtime
WORKDIR /app
COPY --from=production-deps /app/deploy/node_modules ./node_modules
COPY --from=build /app/app/backend/dist/src ./dist/src
COPY --from=build /app/app/backend/dist/scripts ./dist/scripts
COPY app/backend/prisma ./prisma
COPY app/backend/scripts/database-summary.mjs ./scripts/database-summary.mjs
COPY docker/bootstrap-admin.cjs ./scripts/bootstrap-admin.cjs
COPY app/backend/package.json ./package.json

RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));p.scripts={start:'node dist/src/main.js','db:summary':'node scripts/database-summary.mjs','admin:bootstrap':'node scripts/bootstrap-admin.cjs'};delete p.devDependencies;fs.writeFileSync('package.json',JSON.stringify(p,null,2));"

EXPOSE 4001

CMD ["node", "dist/src/main.js"]


