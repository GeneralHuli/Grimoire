FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY web/package.json ./web/package.json
RUN npm install --workspace web

COPY web ./web

WORKDIR /app/web
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
