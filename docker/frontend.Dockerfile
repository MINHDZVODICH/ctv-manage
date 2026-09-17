FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY app/backend/package.json ./app/backend/package.json
COPY app/frontend/package.json ./app/frontend/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=app/frontend --include-workspace-root=false

COPY app/frontend ./app/frontend

RUN npm run build --workspace=app/frontend

FROM nginx:alpine-slim

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/app/frontend/dist /usr/share/nginx/html

EXPOSE 80