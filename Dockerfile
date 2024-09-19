FROM node:20.16.0-alpine3.20

WORKDIR /app

COPY package.json /app

RUN npm install

COPY . /app

EXPOSE 5173

CMD ["npm", "run", "dev"]