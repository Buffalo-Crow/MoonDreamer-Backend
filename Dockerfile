FROM node:22

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Set environment variable defaults
ENV PORT=3001
EXPOSE 3001

CMD ["node", "index.js"]
