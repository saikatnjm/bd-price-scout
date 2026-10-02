# Local development image. Production is built and served by Vercel, not this image.
FROM node:22-alpine

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN chown node:node /app
USER node
# Pre-create so the named volume mounted here is owned by the node user.
RUN mkdir -p /app/.next /app/node_modules

COPY --chown=node:node package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY --chown=node:node . .

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
