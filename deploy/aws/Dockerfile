# docker.io/amazon/aws-cli:2.30.3
FROM docker.io/amazon/aws-cli@sha256:460864ac07f3f3b0fbc17c2702dcf902ab701e9d7b46503649d315c3c0852a92 AS aws-cli

# node:20.19.0-bookworm-slim
FROM node@sha256:8898f8ed3c0126667837b678979b4ed83306c856a1227c8bf5f5f77740c25cd6

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app

COPY --from=aws-cli /usr/local/aws-cli/v2/2.30.3 /usr/local/aws-cli/v2/2.30.3

COPY package.json pnpm-lock.yaml ./
# --no-optional keeps the GPL stockfish package out of the image; the esbuild
# platform binary tsx needs is also optional, so it is restored explicitly.
RUN corepack enable \
  && pnpm install --frozen-lockfile --no-optional --ignore-scripts \
  && cd /tmp \
  && npm pack @esbuild/linux-x64@0.23.1 \
  && mkdir -p /app/node_modules/@esbuild/linux-x64 \
  && tar -xzf esbuild-linux-x64-0.23.1.tgz -C /app/node_modules/@esbuild/linux-x64 --strip-components=1 \
  && rm esbuild-linux-x64-0.23.1.tgz

COPY src ./src
COPY sim ./sim
COPY vendor ./vendor
COPY tsconfig.json ./
COPY deploy/aws/entrypoint.sh /usr/local/bin/spot-entrypoint.sh

RUN ln -s /usr/local/aws-cli/v2/2.30.3 /usr/local/aws-cli/v2/current \
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
