const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const credits = fs.readFileSync(path.join(root, 'public/photo-credits.html'), 'utf8');

const photos = [
  {
    file: 'coast.jpg',
    author: 'Lobster1',
    licence: 'CC BY-SA 3.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Road_Train_Stuart_Highway_-_panoramio.jpg',
    version: '4'
  },
  {
    file: 'show.jpg',
    author: 'Bidgee',
    licence: 'CC BY-SA 3.0 au',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/au/deed.en',
    source: 'https://commons.wikimedia.org/wiki/File:Kenworth_T909_and_Western_Star_6900_on_display_at_the_Riverina_Truck_Show_and_Kids_Convoy_held_at_Lake_Albert.jpg'
  },
  {
    file: 'yard.jpg',
    author: 'Bahnfrend',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Road_trains,_Mundrabilla,_2017_(01).jpg'
  },
  {
    file: 'highway.jpg',
    author: 'Chris Olszewski',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:A-Triple_road_trains_in_Queensland,_Australia,_2024,_02.jpg'
  },
  {
    file: 'outback.jpg',
    author: 'Bahnfrend',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Western_Star_4800_FXB,_Balladonia,_2017_(01).jpg'
  },
  {
    file: 'night.jpg',
    author: 'Phillip Capper from Wellington, New Zealand',
    licence: 'CC BY 2.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Gone_Driveabout_22,_Road_trains,_Mount_Magnet,_Western_Australia,_25_Oct._2010_-_Flickr_-_PhillipC.jpg'
  },
  {
    file: 'port.jpg',
    author: 'BlackCab',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Trucks_on_Francis_Street,_Yarraville.jpg'
  },
  {
    file: 'share.jpg',
    author: 'Kgbo',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:B-Triple_road_trains_in_Queensland,_Australia,_2024,_01.jpg'
  }
];

test('photo credits name the author, licence, and source for each Commons truck photo', () => {
  assert.match(index, /The Drivers <b>Advocate<\/b> App/);
  assert.match(index, /Created for Driver's by Driver's/);
  assert.match(index, /src="\/icon\.svg"/);
  assert.match(index, /\/brand\/work\/dock\.jpg\?v=2/);
  assert.match(index, /\/brand\/work\/quarry\.jpg\?v=2/);
  const mainEnd = index.indexOf('</main>');
  const foot = index.slice(mainEnd);
  assert.ok(mainEnd > 0);
  assert.match(foot, /<footer id="photo-credits" class="photo-foot">/);
  assert.match(index, /\.photo-foot\{[^}]*color:var\(--mut\)[^}]*font-size:11px/);
  assert.equal(index.slice(0, mainEnd).includes('Lobster1'), false);
  assert.equal(index.slice(0, mainEnd).includes('class="photo-credits"'), false);
  for (const photo of photos) {
    assert.ok(fs.existsSync(path.join(root, 'public/brand/work', photo.file)), photo.file);
    assert.ok(index.includes('/brand/work/' + photo.file + '?v=' + (photo.version || '3')), photo.file);
    for (const page of [foot, credits]) {
      assert.ok(page.includes(photo.file), photo.file);
      assert.ok(page.includes(photo.author), photo.author);
      assert.ok(page.includes(photo.licence), photo.licence);
      assert.ok(page.includes(photo.licenceUrl), photo.licenceUrl);
      assert.ok(page.includes(photo.source), photo.source);
    }
  }
  assert.match(credits, /<footer class="photo-foot">/);
  assert.equal(credits.includes('<main'), false);
  assert.match(credits, /\.photo-foot\{[^}]*color:var\(--mut\)[^}]*font-size:11px/);
});
