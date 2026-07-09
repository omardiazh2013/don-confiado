FROM python:3.11-slim

WORKDIR /app

# Copiar requirements
COPY requirements.txt .

# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Cache buster: 1783615541
# Copiar código
COPY . .

# Puerto
EXPOSE 8000

# Comando de inicio
CMD ["python", "tribu-main.py"]
