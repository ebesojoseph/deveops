# Use official Node.js Alpine base image for a small footprint
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies first (better Docker caching)
COPY package*.json ./
RUN npm install

# Install nodemon globally for hot-reloading in dev mode
RUN npm install -g nodemon

# Copy project files
COPY . .

# Expose app port (adjust if your server.js uses a different port)
EXPOSE 3000

# Default command using nodemon to watch file changes
CMD ["nodemon", "server.js"]