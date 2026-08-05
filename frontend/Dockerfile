
FROM node:lts-alpine as build

WORKDIR /app

COPY package*.json ./

COPY node_modules ./node_modules

COPY . .

RUN npm run build

RUN cp -r build result_build
