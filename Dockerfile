# ---- Stage 1: install production dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- Stage 2: final runtime image ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

RUN mkdir -p uploads/resumes && chown -R node:node /app/uploads

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]