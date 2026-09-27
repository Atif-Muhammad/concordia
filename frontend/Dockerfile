# -------- Builder --------
FROM node:22-alpine AS builder
WORKDIR /client
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# -------- Runtime --------
FROM node:22-alpine
WORKDIR /client
RUN npm install -g serve
COPY --from=builder /client/dist ./dist
EXPOSE 5173

CMD ["serve", "-s", "dist", "-l", "5173"]
