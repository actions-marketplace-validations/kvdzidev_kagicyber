FROM node:22-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787
WORKDIR /app
COPY package.json ./
COPY bin ./bin
COPY src ./src
COPY data ./data
RUN useradd --create-home --uid 10001 kagi && chown -R kagi /app
USER kagi
EXPOSE 8787
CMD ["node", "bin/kagicyber.js", "serve"]
