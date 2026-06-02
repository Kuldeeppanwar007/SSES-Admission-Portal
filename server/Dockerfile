FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm i --force

COPY . .

EXPOSE 3009

CMD ["node", "server.js"]
