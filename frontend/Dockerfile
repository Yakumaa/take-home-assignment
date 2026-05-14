FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

EXPOSE 5173

# Vite dev server — host 0.0.0.0 required to be reachable from outside container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]