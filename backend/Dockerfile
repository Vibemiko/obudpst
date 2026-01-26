FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

RUN mkdir -p /var/log/udpst && \
    chown -R node:node /var/log/udpst

USER node

EXPOSE 3000

CMD ["node", "server.js"]
