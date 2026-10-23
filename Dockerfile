FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production PORT=3000
# Keep /app/data on a persistent volume (database, uploads, backups, push keys)
VOLUME ["/app/data"]
EXPOSE 3000
USER node
CMD ["node", "server.js"]
