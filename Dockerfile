# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
