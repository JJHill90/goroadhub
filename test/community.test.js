const test = require('node:test');
const assert = require('node:assert/strict');
const { driverPost, driverReply, makeLimiter } = require('../community');

test('a driver post keeps only the fields the hub is allowed to set', () => {
  const post = driverPost({ a: ' Sam  Porter ', x: 'Who has the road works update?', t: 'Roadworks', g: 4 });
  assert.equal(post.a, 'Sam Porter');
  assert.equal(post.g, 4);
  assert.equal(post.src, 'hub');
  assert.equal(post.pin, false);
  assert.equal(post.driver, true);
});

test('bad names, topics, and groups are rejected', () => {
  assert.throws(() => driverPost({ a: 'A', x: 'Hello there', t: 'Roadworks', g: 1 }));
  assert.throws(() => driverPost({ a: 'Sam', x: 'Hello there', t: 'Gossip', g: 1 }));
  assert.throws(() => driverPost({ a: 'Sam', x: 'Hello there', t: 'Roadworks', g: 40 }));
  assert.throws(() => driverReply({ postId: 'nope', a: 'Sam', x: 'Me too' }));
});

test('replies need a real post id and a short message', () => {
  const reply = driverReply({ postId: 'abc12345-post', a: 'Mia', x: 'Seen this at the bridge.' });
  assert.equal(reply.postId, 'abc12345-post');
  assert.equal(reply.x, 'Seen this at the bridge.');
});

test('posting slows down after the limit', () => {
  const allow = makeLimiter(2, 1000);
  assert.equal(allow('1.2.3.4'), true);
  assert.equal(allow('1.2.3.4'), true);
  assert.equal(allow('1.2.3.4'), false);
  assert.equal(allow('5.6.7.8'), true);
});
