# Hanuman CLI image. Built by .github/workflows/release.yml from the bundled
# CLI tarball (scripts/bundle-cli.js), so it never pulls @usebruno/cli from npm.
#   docker build --build-arg BASE_IMAGE=node:22-slim -f docker/cli/Dockerfile <dir containing hanuman-cli.tgz>
ARG BASE_IMAGE=node:22-alpine
FROM ${BASE_IMAGE}

ARG HANUMAN_VERSION=dev

LABEL org.opencontainers.image.source="https://github.com/toomanyitem/hanuman"
LABEL org.opencontainers.image.description="Hanuman CLI - run API collections from the command line (based on Bruno CLI)"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.title="Hanuman CLI"
LABEL org.opencontainers.image.version="${HANUMAN_VERSION}"

ENV LC_ALL="en_US.UTF-8" \
    LANG="en_US.UTF-8" \
    LANGUAGE="en_US.UTF-8"

COPY hanuman-cli.tgz /tmp/hanuman-cli.tgz

RUN npm install -g /tmp/hanuman-cli.tgz \
    && rm /tmp/hanuman-cli.tgz \
    && npm cache clean --force

WORKDIR /collection

USER node

ENTRYPOINT ["hanuman"]
CMD []
