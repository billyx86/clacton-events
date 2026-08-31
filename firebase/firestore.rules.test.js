/**
 * Firestore security rules tests for Clacton Events.
 *
 * Uses @firebase/rules-unit-testing, which drives the *real* Firestore rules
 * engine via the local Firestore emulator (Java required):
 *
 *   npx firebase emulators:start --only firestore &   # port from firebase.json
 *   node firebase/firestore.rules.test.js
 *
 * CI job: "rules" in .github/workflows/ci.yml runs the same two steps.
 */
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';

const rules = fs.readFileSync(
  path.join(__dirname, 'firestore.rules'),
  'utf8'
);

let passed = 0;
let failed = 0;

async function check(name, promise, expect) {
  try {
    if (expect === 'succeeds') await assertSucceeds(promise);
    else await assertFails(promise);
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}  (${e.message.split('\n')[0]})`);
  }
}

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'demo-clacton-events',
    firestore: { rules, host: '127.0.0.1', port: 18081 },
  });

  // One Firestore instance per context: rules-unit-testing re-applies the
  // emulator connection on every context.firestore() call, and the JS SDK
  // rejects reconfiguration once the instance has started.
  const anonCtx = testEnv.unauthenticatedContext();
  const aliceCtx = testEnv.authenticatedContext('user-alice', {
    email: ALICE,
    email_verified: true,
  });
  const bobCtx = testEnv.authenticatedContext('user-bob', {
    email: BOB,
    email_verified: true,
  });
  const anon = anonCtx.firestore();
  const alice = aliceCtx.firestore();
  const bob = bobCtx.firestore();

  // Seed data through the rules engine (Alice creates her own profile and
  // an event — both allowed, so this also doubles as a write-path test).
  await assertSucceeds(
    alice.collection('users').doc(ALICE).set({
      name: 'Alice',
      email: ALICE,
      photoURL: '',
      accountType: 'personal',
      interestedEvents: [],
    })
  );
  await assertSucceeds(
    alice
      .collection('events')
      .doc('test-event-1')
      .set({
        content: 'Test Event',
        shortDescription: 'A test',
        author: 'Alice',
        emailOfAuthor: ALICE,
      })
  );

  console.log('\nEvents collection:');
  await check('anonymous can list events',
    anon.collection('events').get(), 'succeeds');
  await check('anonymous can get a single event',
    anon.collection('events').doc('test-event-1').get(), 'succeeds');
  await check('anonymous CANNOT create an event',
    anon.collection('events').doc('evil').set({ content: 'x' }), 'fails');
  await check('anonymous CANNOT update an event',
    anon.collection('events').doc('test-event-1').update({ content: 'hacked' }), 'fails');
  await check('anonymous CANNOT delete an event',
    anon.collection('events').doc('test-event-1').delete(), 'fails');
  await check('signed-in user CAN create an event',
    alice.collection('events').doc('alice-event').set({ content: 'Alice event' }), 'succeeds');
  await check('signed-in user CAN update an event',
    bob.collection('events').doc('alice-event').update({ content: 'Bob edited' }), 'succeeds');

  console.log('\nUsers collection:');
  await check('anonymous CANNOT list users',
    anon.collection('users').get(), 'fails');
  await check('anonymous CANNOT read a user doc',
    anon.collection('users').doc(ALICE).get(), 'fails');
  await check('Alice CAN read her own profile',
    alice.collection('users').doc(ALICE).get(), 'succeeds');
  await check('Alice CANNOT list all users (owner-only get, no list rule)',
    alice.collection('users').get(), 'fails');
  await check("Bob CANNOT read Alice's profile",
    bob.collection('users').doc(ALICE).get(), 'fails');
  await check("Bob CANNOT update Alice's profile",
    bob.collection('users').doc(ALICE).update({ name: 'Hacked' }), 'fails');
  await check('Bob CAN create his own profile',
    bob.collection('users').doc(BOB).set({ name: 'Bob', email: BOB, interestedEvents: [] }), 'succeeds');
  await check('Alice CAN update her own profile',
    alice.collection('users').doc(ALICE).update({ name: 'Alice Smith' }), 'succeeds');

  console.log('\nCounters collection:');
  await check('signed-in user CANNOT read counters',
    alice.collection('counters').doc('eventCounter').get(), 'fails');
  await check('signed-in user CANNOT write counters',
    alice.collection('counters').doc('eventCounter').update({ count: 99999 }), 'fails');
  await check('anonymous CANNOT create a counter',
    anon.collection('counters').doc('other').set({ count: 1 }), 'fails');

  console.log('\nDefault deny:');
  await check('anonymous CANNOT read an unknown collection',
    anon.collection('admin').doc('secrets').get(), 'fails');
  await check('anonymous CANNOT list an unknown collection',
    anon.collection('admin').get(), 'fails');

  console.log(`\n${passed} passed, ${failed} failed`);
  await testEnv.cleanup();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
