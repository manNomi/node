// Flags: --experimental-quic --no-warnings

// Test: custom connection ID generator.
// Verifies that SessionOptions.cidGenerator controls locally generated
// connection IDs for both clients and servers.

import { hasQuic, skip, mustCall, mustCallAtLeast } from '../common/index.mjs';
import assert from 'node:assert';

const { ok, rejects, strictEqual } = assert;

if (!hasQuic) {
  skip('QUIC is not enabled');
}

const { listen, connect } = await import('../common/quic.mjs');

function makeCidGenerator(prefix, generated) {
  let counter = 0;
  return mustCallAtLeast((lengthHint) => {
    strictEqual(Number.isInteger(lengthHint), true);
    ok(lengthHint >= 1 && lengthHint <= 20);

    const cid = Buffer.alloc(lengthHint, prefix);
    cid[lengthHint - 1] = ++counter;
    generated.push(cid.toString('hex'));
    return cid;
  }, 1);
}

await rejects(
  listen(() => {}, { cidGenerator: 1 }),
  { code: 'ERR_INVALID_ARG_TYPE' },
);

const invalidEndpoint = await listen(() => {});
await rejects(
  connect(invalidEndpoint.address, { cidGenerator: () => new Uint8Array(0) }),
  { code: 'ERR_INVALID_ARG_VALUE' },
);
await invalidEndpoint.close();

const serverGenerated = [];
const clientGenerated = [];
const serverDone = Promise.withResolvers();

let serverLocalInitialSCID;
let serverRemoteInitialSCID;

const serverEndpoint = await listen(mustCall(async (serverSession) => {
  await serverSession.opened;
  serverLocalInitialSCID = serverSession.localTransportParams.initialSCID;

  serverSession.onstream = mustCall(async (stream) => {
    serverRemoteInitialSCID = serverSession.remoteTransportParams.initialSCID;
    stream.writer.endSync();
    await stream.closed;
    await serverSession.close();
    serverDone.resolve();
  });
}), {
  cidGenerator: makeCidGenerator(0xa1, serverGenerated),
});

const clientSession = await connect(serverEndpoint.address, {
  cidGenerator: makeCidGenerator(0xb2, clientGenerated),
});
await clientSession.opened;

const clientLocalInitialSCID = clientSession.localTransportParams.initialSCID;
const clientRemoteInitialSCID = clientSession.remoteTransportParams.initialSCID;

ok(clientGenerated.includes(clientLocalInitialSCID));
ok(serverGenerated.includes(clientRemoteInitialSCID));

const stream = await clientSession.createUnidirectionalStream();
stream.writer.endSync();
await stream.closed;

await serverDone.promise;

strictEqual(serverLocalInitialSCID, clientRemoteInitialSCID);
strictEqual(serverRemoteInitialSCID, clientLocalInitialSCID);

await clientSession.close();
await clientSession.closed;
await serverEndpoint.close();
