# -------- Builder --------
FROM node:20-slim AS builder

RUN apt-get update -y && apt-get install -y openssl libssl-dev

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build project and generate Prisma client for production stage
RUN npx prisma generate
RUN npm run build

# -------- Production --------
FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl libssl-dev

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
# Keep template requirements inside the backend root; dynamic uploads live in /opt/portal/uploads.
COPY --from=builder /app/template-requirements ./template-requirements
RUN mkdir -p /opt/portal/uploads/staff /opt/portal/uploads/students

EXPOSE 3003

CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && node dist/src/main.js"]