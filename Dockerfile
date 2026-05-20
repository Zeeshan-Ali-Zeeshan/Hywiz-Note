# Stage 1: Build React app
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Run Node/Express server
FROM node:18
WORKDIR /app

# Copy only needed files
COPY package*.json ./
RUN npm install --only=production

# Copy server code
COPY server ./server

# Copy frontend build
COPY --from=build /app/dist ./client

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server/index.js"]
