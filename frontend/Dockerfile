FROM node:20-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code (this is also mounted via volumes in docker-compose, but good for standalone build)
COPY . .

EXPOSE 5173

# Start Vite dev server and expose to network
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
