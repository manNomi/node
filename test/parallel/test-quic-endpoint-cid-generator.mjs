// Flags: --experimental-quic --no-warnings

// Verify that endpoint connection ID policies cover initial, Retry,
// preferred address, and post-handshake short-header packet routing.

import {
  hasQuic,
  mustCall,
  mustCallAtLeast,
  mustNotCall,
  skip,
} from '../common/index.mjs';
import assert from 'node:assert';

const {
  match,
  ok,
  rejects,
  strictEqual,
  throws,
} = assert;

if (!hasQuic) {
  skip('QUIC is not enabled');
}

const { QuicEndpoint } = await import('node:quic');
const { connect, listen } = await import('../common/quic.mjs');

function makeCIDGenerator(prefix, length, generated, expectedCalls = 1) {
  let sequence = 0;
  return mustCallAtLeast((lengthHint) => {
    strictEqual(lengthHint, length);
    const cid = Buffer.alloc(length, prefix);
    cid[length - 1] = ++sequence;
    generated.push(cid.toString('hex'));
    return cid;
  }, expectedCalls);
}

throws(
  () => new QuicEndpoint({ cidLength: 0 }),
  { code: 'ERR_OUT_OF_RANGE' },
);
throws(
  () => new QuicEndpoint({ cidLength: 21 }),
  { code: 'ERR_OUT_OF_RANGE' },
);
throws(
  () => new QuicEndpoint({ cidGenerator: 1 }),
  { code: 'ERR_INVALID_ARG_TYPE' },
);

{
  const serverEndpoint = await listen(mustNotCall(), {
    endpoint: { validateAddress: false },
  });
  const invalidClientEndpoint = new QuicEndpoint({
    cidLength: 8,
    cidGenerator: () => new Uint8Array(7),
  });

  await rejects(
    connect(serverEndpoint.address, { endpoint: invalidClientEndpoint }),
    { code: 'ERR_INVALID_ARG_VALUE' },
  );

  await invalidClientEndpoint.close();
  await serverEndpoint.close();
}

{
  const serverGenerated = [];
  const clientGenerated = [];
  const serverDone = Promise.withResolvers();
  let serverRemoteInitialSCID;

  const serverEndpoint = await listen(mustCall(async (serverSession) => {
    await serverSession.opened;
    serverRemoteInitialSCID =
      serverSession.remoteTransportParams.initialSCID;
    serverSession.onstream = mustCall(async (stream) => {
      stream.writer.endSync();
      await stream.closed;
      await serverSession.close();
      serverDone.resolve();
    });
  }), {
    endpoint: {
      cidLength: 8,
      cidGenerator: makeCIDGenerator(0xa1, 8, serverGenerated, 2),
    },
  });

  const clientSession = await connect(serverEndpoint.address, {
    endpoint: {
      cidLength: 12,
      cidGenerator: makeCIDGenerator(0xb2, 12, clientGenerated),
    },
  });
  await clientSession.opened;

  const clientLocalInitialSCID =
    clientSession.localTransportParams.initialSCID;
  const clientRemoteInitialSCID =
    clientSession.remoteTransportParams.initialSCID;
  const retrySCID = clientSession.remoteTransportParams.retrySCID;

  strictEqual(clientLocalInitialSCID.length, 24);
  strictEqual(clientRemoteInitialSCID.length, 16);
  strictEqual(retrySCID.length, 16);
  match(clientLocalInitialSCID, /^b2/);
  match(clientRemoteInitialSCID, /^a1/);
  match(retrySCID, /^a1/);
  ok(clientGenerated.includes(clientLocalInitialSCID));
  ok(serverGenerated.includes(clientRemoteInitialSCID));

  const stream = await clientSession.createUnidirectionalStream();
  stream.writer.endSync();
  await stream.closed;
  await serverDone.promise;

  strictEqual(serverRemoteInitialSCID, clientLocalInitialSCID);

  await clientSession.close();
  await clientSession.closed;
  await serverEndpoint.close();
}

{
  const serverGenerated = [];
  const preferredAddressValidated = Promise.withResolvers();
  const serverDone = Promise.withResolvers();

  const preferredEndpoint = await listen(mustNotCall(), {
    endpoint: {
      cidLength: 8,
      validateAddress: false,
    },
  });
  const serverEndpoint = await listen(mustCall(async (serverSession) => {
    await serverSession.opened;
    serverSession.onstream = mustCall(async (stream) => {
      stream.writer.endSync();
      await stream.closed;
      await serverSession.close();
      serverDone.resolve();
    });
  }), {
    endpoint: {
      cidLength: 8,
      cidGenerator: makeCIDGenerator(0xc3, 8, serverGenerated, 2),
      validateAddress: false,
    },
    transportParams: {
      preferredAddressIpv4: preferredEndpoint.address,
    },
  });

  const clientSession = await connect(serverEndpoint.address, {
    endpoint: { cidLength: 12 },
    preferredAddressPolicy: 'use',
    onpathvalidation: mustCall((result, _newLocal, _newRemote,
                                _oldLocal, _oldRemote, preferred) => {
      strictEqual(result, 'success');
      strictEqual(preferred, true);
      preferredAddressValidated.resolve();
    }),
  });

  await Promise.all([
    clientSession.opened,
    preferredAddressValidated.promise,
  ]);
  ok(serverGenerated.length >= 2);

  const stream = await clientSession.createUnidirectionalStream();
  stream.writer.endSync();
  await stream.closed;
  await serverDone.promise;

  await clientSession.close();
  await clientSession.closed;
  await serverEndpoint.close();
  await preferredEndpoint.close();
}
