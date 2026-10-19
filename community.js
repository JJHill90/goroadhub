const TOPICS = ['Dashcam', 'Road Rules', 'Safety', 'Fines & Law', 'Roadworks', 'Cyclists & Sharing', 'Q&A', 'Industry News'];

function bad(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function cleanName(value) {
  const name = String(value || '').replace(/[\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 40) throw bad('Enter a name (2–40 characters)');
  return name;
}

function cleanText(value, max) {
  const text = String(value || '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (!text) throw bad('Write something first');
  if (text.length > max) throw bad('That is too long');
  return text;
}

function cleanPostId(value) {
  const id = String(value || '');
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) throw bad('Unknown post');
  return id;
}

function driverPost(body) {
  const g = Number(body && body.g);
  if (!Number.isInteger(g) || g < 0 || g > 15) throw bad('Pick a group');
  const topic = String(body && body.t || '');
  if (!TOPICS.includes(topic)) throw bad('Pick a topic');
  const now = Date.now();
  return {
    g, a: cleanName(body.a), t: topic, x: cleanText(body.x, 2000),
    url: '', src: 'hub', srcName: "The Drivers Advocate App", l: 0, c: 0, pin: false,
    at: now, ord: now, driver: true
  };
}

function driverReply(body) {
  return { postId: cleanPostId(body && body.postId), a: cleanName(body && body.a), x: cleanText(body && body.x, 500), at: Date.now() };
}

function makeLimiter(max, windowMs) {
  const hits = new Map();
  return ip => {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter(t => now - t < windowMs);
    if (recent.length >= max) { hits.set(ip, recent); return false; }
    recent.push(now);
    hits.set(ip, recent);
    return true;
  };
}

module.exports = { TOPICS, driverPost, driverReply, makeLimiter };
