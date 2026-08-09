# Source me. Puts the sysroot Chromium from tools/chromium/install.sh on the
# environment so playwright-core can launch it.
eval "$(node -e '
const j = require("/workspace/.cache/chromium/env.json");
console.log("export CHROME_PATH=" + JSON.stringify(j.chromePath));
for (const [k, v] of Object.entries(j.env)) console.log("export " + k + "=" + JSON.stringify(v));
')"
