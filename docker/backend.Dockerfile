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

FROM manifests AS production-deps
RUN npm ci --omit=dev --workspace=app/backend --include-workspace-root=false
COPY app/backend/prisma ./app/backend/prisma
RUN npm run prisma:generate \
    && mkdir -p app/backend/node_modules

FROM base AS runtime
COPY package.json ./
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/app/backend/node_modules ./app/backend/node_modules
COPY app/backend/package.json ./app/backend/package.json
COPY --from=build /app/app/backend/dist/src ./app/backend/dist/src
COPY --from=build /app/app/backend/dist/scripts ./app/backend/dist/scripts
COPY app/backend/prisma ./app/backend/prisma
COPY app/backend/scripts/database-summary.mjs ./app/backend/scripts/database-summary.mjs
COPY docker/bootstrap-admin.cjs ./app/backend/scripts/bootstrap-admin.cjs
# Only expose commands supported by the production image; no tsx/compiler needed.
RUN node -e "const fs=require('fs');const f='app/backend/package.json';const p=JSON.parse(fs.readFileSync(f));p.scripts={start:p.scripts.start,'prisma:deploy':p.scripts['prisma:deploy'],'db:summary':p.scripts['db:summary'],'admin:bootstrap':'node scripts/bootstrap-admin.cjs'};delete p.devDependencies;delete p.prisma;fs.writeFileSync(f,JSON.stringify(p));"

EXPOSE 4001

CMD ["npm", "run", "start", "--workspace=app/backend"]
