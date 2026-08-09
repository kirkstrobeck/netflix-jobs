FROM node:24.17.0-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
LABEL com.netflix-jobs.sandbox.agent-stack="claude-v2"

ARG HOST_UID=501
ARG HOST_GID=20

RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      curl \
      ca-certificates \
      openssh-client \
      procps \
      ripgrep \
      jq \
      unzip \
      less \
      gosu \
      inotify-tools \
      postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Static Docker CLI matching Colima's daemon API. The Debian docker.io package
# is too old (API 1.41) and rejects calls against Colima's 1.44+ daemon. Inner
# needs this to drive `supabase start`, which spawns sibling containers on the
# host daemon through the mounted socket.
ARG DOCKER_VERSION=27.5.1
RUN ARCH="$(uname -m)" && \
    curl -fsSL "https://download.docker.com/linux/static/stable/${ARCH}/docker-${DOCKER_VERSION}.tgz" \
      | tar -xz -C /tmp && \
    install -m 0755 /tmp/docker/docker /usr/local/bin/docker && \
    rm -rf /tmp/docker

# Supabase CLI, pinned to the version already installed on the host so the
# generated config.toml and container images don't drift between the two.
ARG SUPABASE_VERSION=2.111.0
# NB: the supabase tar.gz asset is UNVERSIONED in its filename
# (supabase_linux_<arch>.tar.gz) — the version lives only in the tag path.
RUN ARCH="$(dpkg --print-architecture)" && \
    curl -fsSL "https://github.com/supabase/cli/releases/download/v${SUPABASE_VERSION}/supabase_linux_${ARCH}.tar.gz" \
      -o /tmp/supabase.tar.gz && \
    tar -xzf /tmp/supabase.tar.gz -C /usr/local/bin supabase && \
    rm /tmp/supabase.tar.gz && \
    supabase --version

RUN npm install -g \
      pnpm@11.17.0 \
      @anthropic-ai/claude-code \
    && claude --version

RUN ( getent group ${HOST_GID} >/dev/null || groupadd -g ${HOST_GID} agentgrp ) \
    && useradd -m -u ${HOST_UID} -g ${HOST_GID} -s /bin/bash agent

COPY AGENT.md /etc/sandbox-agent.md
COPY entrypoint.sh /usr/local/bin/sandbox-entrypoint
RUN chmod +x /usr/local/bin/sandbox-entrypoint

RUN install -d -o agent -g ${HOST_GID} /home/agent/.claude

# Headless Chromium for the Lighthouse gate (pnpm test:lighthouse).
#
# Two halves, and they have to be split this way. The shared libraries are a
# root-time apt install, so they belong in the image. The browser binary is a
# 195MB download that must land on a filesystem where chmod works -- which rules
# out /workspace, a virtiofs bind mount from the Mac -- so it goes to the agent's
# own home and is fetched as that user, in the standard Playwright location.
#
# tools/chromium/install.sh does both of these again at runtime, without root,
# for containers running an image built before this. When the image already
# carries them it finds the browser, resolves zero missing packages, and exits.
# The package list here is the same tools/chromium/packages.txt, kept in sync by
# hand -- a COPY would pull the repo into the image, which it deliberately isn't.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcairo2 \
      libcups2 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libnspr4 libnss3 \
      libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 \
      libxfixes3 libxkbcommon0 libxrandr2 libfontconfig1 libfreetype6 \
      fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ARG PLAYWRIGHT_VERSION=1.62.1
USER agent
RUN PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 \
      npx --yes playwright-core@${PLAYWRIGHT_VERSION} install chromium \
    && /home/agent/.cache/ms-playwright/chromium-*/chrome-linux/chrome --version
USER root

# Bind-mounted host worktrees show ownership that doesn't always match the
# container UID through Colima's filesystem layer. Trust everything; the
# container is already the trust boundary.
RUN git config --system --add safe.directory '*'

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/sandbox-entrypoint"]
CMD ["sleep", "infinity"]
