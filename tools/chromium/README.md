# Headless Chromium, without root

`install.sh` makes a headless Chromium runnable from nothing, as an
unprivileged user, on a fresh container. `pnpm test:lighthouse` runs it first,
so nobody has to know it exists. Run it by hand if you want a browser for
anything else:

```
bash tools/chromium/install.sh          # ~29s cold, ~1s warm
```

It writes `.cache/chromium/env.json`: the browser path and the three environment
variables needed to launch it.

## The two halves, and why they live in different places

The **shared libraries** are a root-time `apt-get install`, so they belong in
the image — `tools/sandbox/Dockerfile` installs them, and the package list there
mirrors `packages.txt`.

The **browser binary** is a 195MB download that Playwright `chmod +x`es as its
final step. `chmod` on virtiofs returns `EPERM`, and `/workspace` is a virtiofs
bind mount from the Mac, so the binary cannot live under the repo. It goes to
`~/.cache/ms-playwright`, Playwright's standard path, on the container's own
filesystem. That means a fresh container re-downloads it — unless the image
carries it, which is why the Dockerfile pre-fetches it as the `agent` user.

`install.sh` does both again at runtime, so a container running an older image
still works. When the image already has them, it finds the browser, resolves
zero missing packages, and exits after one `chrome --version`.

## Three things that are not obvious

**`Dir::State::status` stays at `/var/lib/dpkg/status`.** Every other apt
directory is redirected somewhere writable, because that is the whole trick that
lets `apt-get` run without root. Redirect the status file too and apt believes
nothing at all is installed: the "dependency closure" becomes the entire base
system, 182 packages including `tar` and `coreutils`, which then fail to unpack
over themselves. Left alone, apt answers the question actually being asked —
what is missing from *this* image — which is 50 packages here and zero on an
image built from the current Dockerfile.

**`--no-install-recommends`.** Without it the closure drags in `systemd` and
`x11-common`, whose unit files and read-only directories are the source of most
of the extraction failures you would otherwise spend an afternoon on.

**`tar -P`.** `fontconfig-config` ships its `conf.d` entries as symlinks to
*absolute* paths. GNU tar treats an absolute symlink target as potentially
hostile: it writes a mode-000 placeholder, finishes extraction, then replays the
real link by reopening the placeholder. Reopening a mode-000 file succeeds only
for root — so unprivileged, every one of those links dies with `Cannot open:
Permission denied`. `-P` disables the protection and the symlinks are written
directly. Nothing in these archives has an absolute *member* path (they are all
`./usr/...`), so the protection has nothing to protect. `-m`,
`--no-same-permissions` and `--no-same-owner` are there for the same class of
reason: no `utime`, no `chmod`, no `chown` on a filesystem that refuses all
three.

Those absolute symlinks dangle afterwards, pointing at a `/usr/share/fontconfig`
that does not exist. Rather than rewrite twenty links, `install.sh` overwrites
`fonts.conf` with the two facts that matter: where the fonts are, where the
cache goes.
