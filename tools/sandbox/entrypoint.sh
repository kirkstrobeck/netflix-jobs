#!/usr/bin/env bash
set -euo pipefail

# Runs as root, sets up the agent user's world, then drops privileges for the
# long-lived container process.

# Match the host Docker socket GID so the agent user can talk to the host
# Docker daemon (Colima) through the mounted socket.
if [ -S /var/run/docker.sock ]; then
  sock_gid="$(stat -c '%g' /var/run/docker.sock)"
  if [ "$sock_gid" != "0" ] && ! id -G agent | tr ' ' '\n' | grep -qx "$sock_gid"; then
    getent group "$sock_gid" >/dev/null || groupadd -g "$sock_gid" docker-host
    usermod -aG "$sock_gid" agent
  fi
fi

# Inner's user-global instructions come from the baked-in rules so it works
# directly instead of recursively dispatching back into the sandbox. The home
# dir is a host-backed bind mount already owned by the host user; the container
# can't chown through Colima's mount layer (EPERM), so keep fix-ups best-effort.
mkdir -p /home/agent/.claude
if [ -f /etc/sandbox-agent.md ]; then
  cp -f /etc/sandbox-agent.md /home/agent/.claude/CLAUDE.md
  chown agent:"$(id -g agent)" /home/agent/.claude/CLAUDE.md 2>/dev/null || true
fi

# Mirror the host git identity so commits made inside carry the right author.
# Best-effort: a transient failure must never keep the container from starting.
if [ -n "${HOST_GIT_NAME:-}" ]; then
  gosu agent env HOME=/home/agent git config --global user.name "$HOST_GIT_NAME" || true
fi
if [ -n "${HOST_GIT_EMAIL:-}" ]; then
  gosu agent env HOME=/home/agent git config --global user.email "$HOST_GIT_EMAIL" || true
fi

# Never let an accidental `git commit` without -m/-F open an editor on the host.
gosu agent env HOME=/home/agent git config --global core.editor /bin/false || true
export GIT_EDITOR=/bin/false
export VISUAL=/bin/false
export EDITOR=/bin/false

exec gosu agent env HOME=/home/agent "$@"
