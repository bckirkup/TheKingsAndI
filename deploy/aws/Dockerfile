# public.ecr.aws/aws-cli/aws-cli:2.22.35
FROM public.ecr.aws/aws-cli/aws-cli@sha256:2cbc01b9a16896b248ebab5c8555e82b54e3eb26c125f4b0a04112d0e9ca5ab2 AS aws-cli

# node:20.19.0-bookworm-slim
FROM node@sha256:8898f8ed3c0126667837b678979b4ed83306c856a1227c8bf5f5f77740c25cd6

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app

COPY --from=aws-cli /usr/local/aws-cli/v2/2.22.35 /usr/local/aws-cli/v2/2.22.35

COPY package.json pnpm-lock.yaml ./
RUN corepack enable \
  && pnpm install --frozen-lockfile --no-optional --ignore-scripts

COPY src ./src
COPY sim ./sim
COPY vendor ./vendor
COPY tsconfig.json ./
COPY deploy/aws/entrypoint.sh /usr/local/bin/spot-entrypoint.sh

RUN ln -s /usr/local/aws-cli/v2/2.22.35 /usr/local/aws-cli/v2/current \
  && ln -s /usr/local/aws-cli/v2/current/bin/aws /usr/local/bin/aws \
  && chmod 755 /usr/local/bin/spot-entrypoint.sh \
  && test ! -e /app/node_modules/stockfish \
  && if find /app/node_modules -iname '*stockfish*' -print -quit | grep -q .; then \
       echo 'Stockfish artifact found in the Lozza-only image.' >&2; \
       exit 1; \
     fi \
  && aws --version \
  && mkdir -p /work \
  && chown -R node:node /app /work

USER node
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/spot-entrypoint.sh"]
