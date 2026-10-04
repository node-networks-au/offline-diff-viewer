# diff-api: the createLink/getLink Express backend. Built from this repo's api/
# and pinned by digest in the cluster, so the code that runs is the code that
# was reviewed (previously the pod git-synced a third-party branch HEAD and ran
# an unpinned `npm install` on every start).
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY . .

ENV NODE_ENV=production
USER node
EXPOSE 3000

CMD ["node", "--import", "tsx", "server.ts"]
