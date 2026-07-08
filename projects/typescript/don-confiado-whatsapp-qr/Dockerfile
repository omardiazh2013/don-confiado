FROM node:20-alpine

WORKDIR /app

# Copiar package.json y lock
COPY package.json yarn.lock ./

# Instalar dependencias
RUN yarn install --frozen-lockfile

# Copiar código
COPY . .

# Puerto
EXPOSE 3000

# Comando por defecto
CMD ["yarn", "start:wa"]
