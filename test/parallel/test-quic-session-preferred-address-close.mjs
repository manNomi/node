// Flags: --experimental-quic --no-warnings

// Test: CONNECTION_CLOSE follows a validated preferred-address path.
// Once the server session has migrated to its preferred endpoint, closing
// the session must send the terminal packet from that endpoint.

import { hasQuic, skip, mustCall, mustNotCall } from '../common/index.mjs';
import assert from 'node:assert';
import { setTimeout } from 'node:timers/promises';

if (!hasQuic) {
  skip('QUIC is not enabled');
}

const { listen, connect } = await import('../common/quic.mjs');

function assertEqualAddress(actual, expected) {
  assert.strictEqual(actual.address, expected.address);
  assert.strictEqual(actual.port, expected.port);
  assert.strictEqual(actual.family, expected.family);
}

const serverAccepted = Promise.withResolvers();
const serverPathValidated = Promise.withResolvers();
const clientPathValidated = Promise.withResolvers();
let serverSession;

const preferredEndpoint = await listen(mustNotCall(), {
  onerror() {},
});

const serverEndpoint = await listen(mustCall((session) => {
  serverSession = session;
  session.onpathvalidation = mustCall((result, newLocal, newRemote,
                                       oldLocal, oldRemote, preferred) => {
    assert.notStrictEqual(result, 'failure');
    assertEqualAddress(newLocal, preferredEndpoint.address);
    assertEqualAddress(oldLocal, serverEndpoint.address);
    assertEqualAddress(newRemote, oldRemote);
    assert.strictEqual(preferred, undefined);
    serverPathValidated.resolve();
  });
  serverAccepted.resolve();
}), {
  transportParams: {
    preferredAddressIpv4: preferredEndpoint.address,
  },
  onerror() {},
});

const clientSession = await connect(serverEndpoint.address, {
  reuseEndpoint: false,
  preferredAddressPolicy: 'use',
  onerror: mustCall((error) => {
    assert.strictEqual(error.code, 'ERR_QUIC_APPLICATION_ERROR');
    assert.strictEqual(error.errorCode, 42n);
    assert.strictEqual(error.reason, 'server shutdown');
  }),
  onpathvalidation: mustCall((result, newLocal, newRemote,
                              oldLocal, oldRemote, preferred) => {
    assert.strictEqual(result, 'success');
    assertEqualAddress(newLocal, clientSession.endpoint.address);
    assertEqualAddress(newRemote, preferredEndpoint.address);
    assert.strictEqual(oldLocal, null);
    assert.strictEqual(oldRemote, null);
    assert.strictEqual(preferred, true);
    clientPathValidated.resolve();
  }),
});

await Promise.all([
  clientSession.opened,
  serverAccepted.promise,
  serverPathValidated.promise,
  clientPathValidated.promise,
]);

// Let path-validation acknowledgements drain, then verify both endpoints
// are idle before attributing the next packet to session.close().
await setTimeout(100);
const primaryPacketsBeforeClose = serverEndpoint.stats.packetsSent;
const packetsBeforeClose = preferredEndpoint.stats.packetsSent;
await setTimeout(100);
assert.strictEqual(
  serverEndpoint.stats.packetsSent,
  primaryPacketsBeforeClose,
);
assert.strictEqual(
  preferredEndpoint.stats.packetsSent,
  packetsBeforeClose,
);

const clientClosed = assert.rejects(clientSession.closed, {
  code: 'ERR_QUIC_APPLICATION_ERROR',
  errorCode: 42n,
  reason: 'server shutdown',
});

await serverSession.close({
  code: 42n,
  type: 'application',
  reason: 'server shutdown',
});
await clientClosed;

assert.strictEqual(
  serverEndpoint.stats.packetsSent,
  primaryPacketsBeforeClose,
);
assert.ok(
  preferredEndpoint.stats.packetsSent > packetsBeforeClose,
  'CONNECTION_CLOSE should be sent by the preferred endpoint',
);

await serverEndpoint.close();
await preferredEndpoint.close();
