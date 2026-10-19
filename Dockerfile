FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV PORT=5173
ENV DATABASE_PATH=/app/.data/campusdeck.sqlite
EXPOSE 5173
CMD ["npm","start"]
