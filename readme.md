- NodeJS + Hono
- PostgresSQL
- NGINX

```
docker buildx create --name rinha-nodejs --platform linux/amd64,linux/arm64,linux/arm64/v8
docker buildx build -t met4tron/rinha-nodejs-q1-2024:latest --builder rinha-nodejs --push --platform linux/arm64/v8,linux/amd64,linux/arm64 .
```