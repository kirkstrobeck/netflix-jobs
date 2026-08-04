// Loopback -> host forwarder for running the Supabase CLI inside the sandbox.
//
// The CLI talks to the Mac's Docker daemon over the mounted socket, so the
// containers it starts are siblings of this one and their published ports land
// on the Mac (reachable here as host.docker.internal). The CLI, however, always
// dials 127.0.0.1 for its health checks and migrations. This bridges the gap:
//
//   node tools/supabase-port-forward.mjs &
//   supabase start
//
// Connections refuse until the sibling container publishes its port, which is
// exactly what the CLI's own retry loop expects.

import net from 'node:net';

const HOST = process.env.FORWARD_HOST ?? 'host.docker.internal';
const PORTS = (process.env.FORWARD_PORTS ?? '54720,54721,54722,54723,54724,54727,54729')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter(Boolean);

function forward(port) {
  const server = net.createServer((client) => {
    const upstream = net.connect(port, HOST);
    client.on('error', () => upstream.destroy());
    upstream.on('error', () => client.destroy());
    client.pipe(upstream);
    upstream.pipe(client);
  });

  server.on('error', (err) => {
    console.error(`forward ${port}: ${err.message}`);
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`forwarding 127.0.0.1:${port} -> ${HOST}:${port}`);
  });
}

PORTS.forEach(forward);
