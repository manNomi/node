// Flags: --experimental-quic --experimental-stream-iter --no-warnings

// Test: a client session can migrate to a newly bound endpoint. Data must
// continue to flow on the same session and session.path must reflect the
// validated path without changing object identity.

import { hasQuic, mustCall, skip } from '../common/index.mjs';
import assert from 'node:assert';
import { bytes } from 'node:stream/iter';

if (!hasQuic) {
  skip('QUIC is not enabled');
}

const { QuicEndpoint } = await import('node:quic');
const { connect, listen } = await import('../common/quic.mjs');

const serverSessionReady = Promise.withResolvers();

const serverEndpoint = await listen(mustCall((session) => {
  session.onstream = mustCall(async (stream) => {
    stream.writer.writeSync(await bytes(stream));
    stream.writer.endSync();
  }, 3);
  serverSessionReady.resolve(session);
}));

const originalEndpoint = new QuicEndpoint({
  address: '127.0.0.1:0',
});
const migrationEndpoint = new QuicEndpoint({
  address: '127.0.0.1:0',
});
const competingEndpoint = new QuicEndpoint({
  address: '127.0.0.1:0',
});
const serverMigrationEndpoint = new QuicEndpoint({
  address: '127.0.0.1:0',
});
const clientSession = await connect(serverEndpoint.address, {
  endpoint: originalEndpoint,
});
const serverSession = await serverSessionReady.promise;
await clientSession.opened;

await assert.rejects(serverSession.migrate(serverMigrationEndpoint), {
  code: 'ERR_INVALID_STATE',
  message: /Only client sessions/,
});
assert.strictEqual(serverMigrationEndpoint.address, undefined);

await assert.rejects(clientSession.migrate({}), {
  code: 'ERR_INVALID_ARG_TYPE',
});

async function exchange(value) {
  const stream = await clientSession.createBidirectionalStream();
  stream.writer.writeSync(value);
  stream.writer.endSync();
  const result = await bytes(stream);
  await stream.closed;
  return Buffer.from(result).toString();
}

assert.strictEqual(await exchange('before migration'), 'before migration');

const path = clientSession.path;
assert.strictEqual(path.local.port, originalEndpoint.address.port);
assert.strictEqual(migrationEndpoint.address, undefined);

const migration = clientSession.migrate(migrationEndpoint);
await assert.rejects(clientSession.migrate(competingEndpoint), {
  code: 'ERR_INVALID_STATE',
  message: /already pending/,
});
assert.strictEqual(competingEndpoint.address, undefined);
await migration;

assert.ok(migrationEndpoint.address.port > 0);
assert.strictEqual(clientSession.path, path);
assert.strictEqual(path.local.address, migrationEndpoint.address.address);
assert.strictEqual(path.local.port, migrationEndpoint.address.port);
assert.strictEqual(path.local.family, migrationEndpoint.address.family);
assert.strictEqual(await exchange('after migration'), 'after migration');

// Returning to a previously validated path can complete synchronously in
// ngtcp2 and must still settle the public migration promise.
await clientSession.migrate(originalEndpoint);
assert.strictEqual(clientSession.path, path);
assert.strictEqual(path.local.address, originalEndpoint.address.address);
assert.strictEqual(path.local.port, originalEndpoint.address.port);
assert.strictEqual(path.local.family, originalEndpoint.address.family);
assert.strictEqual(await exchange('after return'), 'after return');

await clientSession.close();
await serverSession.closed;
await Promise.all([
  originalEndpoint.close(),
  migrationEndpoint.close(),
  competingEndpoint.close(),
  serverMigrationEndpoint.close(),
  serverEndpoint.close(),
]);
