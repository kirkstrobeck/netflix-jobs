#!/usr/bin/env bash
#
# Make a headless Chromium runnable, from nothing, without root.
#
# The sandbox container has no sudo, so `apt-get install` is out. `apt-get
# download` is not -- apt only needs root for the dirs it writes, and every one
# of those is redirectable. So: resolve the dependency closure through apt,
# fetch the .deb files, unpack them into a private sysroot, and point
# LD_LIBRARY_PATH at it.
#
# Idempotent and cheap on the happy path: if a Chromium already starts, this
# exits after one `--version` call. Safe to run at the top of every test run,
# which is what tools/lighthouse does.
#
# Output: $CACHE/env.json, the environment a caller needs to launch the browser.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CACHE="${CHROMIUM_CACHE_DIR:-$REPO_ROOT/.cache/chromium}"
SYSROOT="$CACHE/sysroot"
DEBS="$CACHE/debs"

# The browser is the one thing that CANNOT live in $CACHE. $CACHE sits under the
# repo, the repo is a virtiofs bind mount from the Mac, and chmod on virtiofs
# returns EPERM -- Playwright's downloader chmods the binary +x as its last step
# and dies there. So the browser goes to the container's own filesystem, at
# Playwright's standard path, where an image that ships one is already found.
# The tradeoff is honest: a fresh container re-downloads 195MB in ~90s unless
# the image carries it (see tools/sandbox/Dockerfile, which now does).
BROWSERS="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
APT_STATE="$CACHE/apt"
PACKAGES="$(dirname "${BASH_SOURCE[0]}")/packages.txt"

log() { printf 'chromium: %s\n' "$*" >&2; }

# Every place a browser could already be: an explicit override, a copy this
# script downloaded before, a Playwright cache baked into the image, a distro
# package. First one that exists wins -- downloading 150MB is the last resort.
find_chrome() {
  local candidate
  for candidate in \
    "${CHROME_PATH:-}" \
    "$BROWSERS"/chromium-*/chrome-linux/chrome \
    "$(command -v chromium || true)" \
    "$(command -v chromium-browser || true)" \
    "$(command -v google-chrome-stable || true)"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 0
}

# PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS because Playwright's post-download
# check looks for the very shared libraries this script is about to unpack, and
# fails the install over their absence. Its verdict is not the one that counts;
# `chrome --version` a few lines below is, so the exit status is ignored too.
download_chrome() {
  log "no browser found; downloading Chromium into $BROWSERS"
  local pkg
  pkg="$(node -e "console.log(require.resolve('playwright-core/package.json'))")"
  PLAYWRIGHT_BROWSERS_PATH="$BROWSERS" \
    PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 \
    node "$(dirname "$pkg")/cli.js" install chromium >&2 || true
}

# Directories inside the sysroot that actually contain shared objects. Derived
# rather than spelled out so this works on arm64 and x86_64 without a triplet
# lookup table.
sysroot_lib_path() {
  if [ ! -d "$SYSROOT" ]; then
    return 0
  fi
  find "$SYSROOT" -name '*.so*' -type f -printf '%h\n' 2>/dev/null | sort -u | paste -sd:
}

apt_get() {
  apt-get \
    -o Dir::State="$APT_STATE" \
    -o Dir::State::Lists="$APT_STATE/lists" \
    -o Dir::State::status=/var/lib/dpkg/status \
    -o Dir::Cache="$APT_STATE/cache" \
    -o Dir::Cache::archives="$APT_STATE/cache/archives" \
    -o Debug::NoLocking=1 \
    -o APT::Sandbox::User=root \
    "$@" 2> >(grep -v 'archives/partial' >&2)
}

# apt resolves the closure and prints where each .deb lives; curl fetches them,
# tar unpacks them. No package database is touched, so none of this needs root
# and none of it can break the image. Note Dir::State::status above: it stays
# pointed at the REAL dpkg status while every other apt dir is redirected, so
# the closure is "what is missing from this image" and not the whole base
# system. See README.md for what happens when it isn't.
install_libs() {
  log "unpacking runtime libraries into $SYSROOT"
  mkdir -p "$APT_STATE/lists/partial" "$APT_STATE/cache/archives/partial" "$DEBS" "$SYSROOT"

  local seeds
  seeds="$(grep -v '^\s*#' "$PACKAGES" | grep -v '^\s*$' | paste -sd' ')"

  apt_get update >/dev/null
  # shellcheck disable=SC2086
  apt_get install --no-install-recommends --print-uris -y $seeds \
    | grep "^'" \
    | cut -d"'" -f2 \
    > "$CACHE/urls.txt"

  log "$(wc -l < "$CACHE/urls.txt") packages to fetch"
  local url name
  while read -r url; do
    name="$(basename "$url")"
    if [ ! -f "$DEBS/$name" ]; then
      curl -fsSL "$url" -o "$DEBS/$name"
    fi
    # Not `dpkg -x`, and every tar flag here earns its place as an unprivileged
    # user -- -P especially, which is not laziness. README.md explains each one.
    dpkg-deb --fsys-tarfile "$DEBS/$name" \
      | tar -xf - -C "$SYSROOT" -P -m --no-same-permissions --no-same-owner
  done < "$CACHE/urls.txt"

  write_fontconfig
}

# Those absolute conf.d symlinks now dangle -- they point at /usr/share on the
# host, which has no fontconfig. Rather than rewrite 20 links, replace the whole
# config with the two facts that matter: where the fonts are and where the cache
# goes. Chrome loads the site's own woff2 files itself, so this only governs
# fallback text -- but fallback text is what the contrast and tap-target audits
# measure when a webfont is still in flight.
write_fontconfig() {
  mkdir -p "$SYSROOT/etc/fonts" "$CACHE/fontconfig"
  cat > "$SYSROOT/etc/fonts/fonts.conf" <<XML
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>$SYSROOT/usr/share/fonts</dir>
  <cachedir>$CACHE/fontconfig</cachedir>
</fontconfig>
XML
}

chrome_runs() {
  "$1" --version >/dev/null 2>&1
}

write_env() {
  node -e '
    const [chrome, libPath, sysroot, out] = process.argv.slice(1);
    const env = {
      LD_LIBRARY_PATH: libPath,
      XDG_DATA_DIRS: `${sysroot}/usr/share:/usr/local/share:/usr/share`,
      FONTCONFIG_PATH: `${sysroot}/etc/fonts`,
    };
    require("fs").writeFileSync(out, JSON.stringify({chromePath: chrome, env}, null, 2) + "\n");
  ' "$1" "$2" "$SYSROOT" "$CACHE/env.json"
}

main() {
  mkdir -p "$CACHE"

  local chrome
  chrome="$(find_chrome)"
  if [ -z "$chrome" ]; then
    download_chrome
    chrome="$(find_chrome)"
  fi
  if [ -z "$chrome" ]; then
    log "FATAL: no Chromium after download attempt"
    exit 1
  fi
  log "using $chrome"

  local lib_path
  lib_path="$(sysroot_lib_path)"
  export LD_LIBRARY_PATH="${lib_path}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

  if ! chrome_runs "$chrome"; then
    install_libs
    lib_path="$(sysroot_lib_path)"
    export LD_LIBRARY_PATH="${lib_path}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  fi

  if ! chrome_runs "$chrome"; then
    log "FATAL: Chromium still will not start. Missing objects:"
    ldd "$chrome" 2>&1 | grep 'not found' >&2 || true
    exit 1
  fi

  write_env "$chrome" "$lib_path"
  log "$("$chrome" --version) ready ($CACHE/env.json)"
}

main "$@"
