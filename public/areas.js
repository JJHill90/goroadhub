// Places a driving story can belong to. Matching uses the headline and the
// summary, not the driver's phone location.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Areas = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const OVERSEAS = /\b(?:wichita|kansas|california|texas|florida|new york|los angeles|chicago|london|toronto|vancouver|united states|u\.s\.a?)\b/i;

  function place(id, name, group, parent, country, words) {
    return { id, name, group, parent, country, words: words || [] };
  }

  const AREAS = [
    place('au', 'All of Australia', 'Australia', '', 'AU'),
    place('nsw', 'All of New South Wales', 'New South Wales', 'au', 'AU', ['new south wales', 'nsw']),
    place('nsw-sydney', 'Sydney', 'New South Wales', 'nsw', 'AU', ['sydney', 'parramatta', 'penrith', 'liverpool', 'blacktown', 'campbelltown', 'hornsby', 'chatswood', 'bondi', 'manly', 'canterbury-bankstown']),
    place('nsw-hunter', 'Hunter', 'New South Wales', 'nsw', 'AU', ['newcastle', 'maitland', 'cessnock', 'singleton', 'muswellbrook', 'raymond terrace', 'hunter valley']),
    place('nsw-central-coast', 'Central Coast', 'New South Wales', 'nsw', 'AU', ['gosford', 'wyong', 'terrigal', 'woy woy']),
    place('nsw-illawarra', 'Illawarra', 'New South Wales', 'nsw', 'AU', ['wollongong', 'shellharbour', 'kiama', 'port kembla', 'illawarra']),
    place('nsw-south-coast', 'South Coast', 'New South Wales', 'nsw', 'AU', ['nowra', 'batemans bay', 'ulladulla', 'bermagui', 'narooma']),
    place('nsw-north-coast', 'North Coast', 'New South Wales', 'nsw', 'AU', ['coffs harbour', 'port macquarie', 'grafton', 'lismore', 'ballina', 'byron bay', 'tweed heads']),
    place('nsw-new-england', 'New England', 'New South Wales', 'nsw', 'AU', ['armidale', 'tamworth', 'inverell', 'glen innes', 'moree', 'new england']),
    place('nsw-central-west', 'Central West', 'New South Wales', 'nsw', 'AU', ['bathurst', 'dubbo', 'mudgee', 'parkes', 'forbes', 'cowra', 'lithgow']),
    place('nsw-riverina', 'Riverina', 'New South Wales', 'nsw', 'AU', ['wagga', 'griffith', 'leeton', 'narrandera', 'temora', 'riverina']),
    place('nsw-murray', 'Murray', 'New South Wales', 'nsw', 'AU', ['albury', 'deniliquin', 'finley', 'moama', 'tocumwal']),
    place('nsw-far-west', 'Far West', 'New South Wales', 'nsw', 'AU', ['broken hill', 'wilcannia', 'bourke', 'cobar', 'lightning ridge']),
    place('nsw-snowy', 'Snowy Mountains', 'New South Wales', 'nsw', 'AU', ['cooma', 'jindabyne', 'tumut', 'thredbo', 'perisher', 'snowy mountains']),

    place('vic', 'All of Victoria', 'Victoria', 'au', 'AU', ['victoria', 'vic']),
    place('vic-melbourne', 'Melbourne', 'Victoria', 'vic', 'AU', ['melbourne', 'footscray', 'dandenong', 'frankston', 'ringwood', 'werribee']),
    place('vic-geelong', 'Geelong', 'Victoria', 'vic', 'AU', ['geelong', 'colac']),
    place('vic-ballarat', 'Ballarat', 'Victoria', 'vic', 'AU', ['ballarat']),
    place('vic-bendigo', 'Bendigo', 'Victoria', 'vic', 'AU', ['bendigo', 'castlemaine', 'echuca']),
    place('vic-shepparton', 'Shepparton', 'Victoria', 'vic', 'AU', ['shepparton']),
    place('vic-gippsland', 'Gippsland', 'Victoria', 'vic', 'AU', ['gippsland', 'traralgon', 'morwell', 'bairnsdale', 'lakes entrance', 'wonthaggi']),
    place('vic-wimmera', 'Wimmera', 'Victoria', 'vic', 'AU', ['wimmera', 'horsham', 'nhill', 'stawell', 'ararat']),
    place('vic-mallee', 'Mallee', 'Victoria', 'vic', 'AU', ['mallee', 'mildura', 'swan hill', 'ouyen']),
    place('vic-hume', 'Hume', 'Victoria', 'vic', 'AU', ['wangaratta', 'wodonga', 'beechworth']),
    place('vic-southwest', 'South West', 'Victoria', 'vic', 'AU', ['warrnambool', 'portland']),

    place('qld', 'All of Queensland', 'Queensland', 'au', 'AU', ['queensland', 'qld']),
    place('qld-brisbane', 'Brisbane', 'Queensland', 'qld', 'AU', ['brisbane', 'ipswich', 'logan', 'redcliffe', 'caboolture', 'springfield lakes', 'centenary motorway']),
    place('qld-gold-coast', 'Gold Coast', 'Queensland', 'qld', 'AU', ['gold coast', 'surfers paradise', 'coolangatta']),
    place('qld-sunshine', 'Sunshine Coast', 'Queensland', 'qld', 'AU', ['sunshine coast', 'caloundra', 'maroochydore', 'noosa']),
    place('qld-downs', 'Darling Downs', 'Queensland', 'qld', 'AU', ['darling downs', 'toowoomba', 'warwick', 'dalby', 'roma', 'goondiwindi']),
    place('qld-wide-bay', 'Wide Bay', 'Queensland', 'qld', 'AU', ['wide bay', 'bundaberg', 'hervey bay', 'maryborough', 'gympie']),
    place('qld-central', 'Central Queensland', 'Queensland', 'qld', 'AU', ['rockhampton', 'gladstone', 'emerald', 'biloela']),
    place('qld-mackay', 'Mackay and Whitsunday', 'Queensland', 'qld', 'AU', ['mackay', 'whitsunday', 'airlie beach', 'proserpine', 'bowen']),
    place('qld-north', 'North Queensland', 'Queensland', 'qld', 'AU', ['townsville', 'charters towers', 'ingham']),
    place('qld-far-north', 'Far North Queensland', 'Queensland', 'qld', 'AU', ['cairns', 'innisfail', 'mareeba', 'atherton', 'port douglas', 'weipa', 'far north queensland']),
    place('qld-outback', 'Outback Queensland', 'Queensland', 'qld', 'AU', ['mount isa', 'longreach', 'charleville', 'winton', 'cloncurry', 'birdsville']),

    place('sa', 'All of South Australia', 'South Australia', 'au', 'AU', ['south australia', 'sa']),
    place('sa-adelaide', 'Adelaide', 'South Australia', 'sa', 'AU', ['adelaide', 'glenelg', 'port adelaide']),
    place('sa-barossa', 'Barossa', 'South Australia', 'sa', 'AU', ['barossa', 'tanunda', 'nuriootpa']),
    place('sa-fleurieu', 'Fleurieu', 'South Australia', 'sa', 'AU', ['fleurieu', 'victor harbor', 'goolwa']),
    place('sa-murray', 'Murraylands', 'South Australia', 'sa', 'AU', ['murray bridge', 'renmark', 'berri', 'waikerie', 'loxton']),
    place('sa-limestone', 'Limestone Coast', 'South Australia', 'sa', 'AU', ['limestone coast', 'mount gambier', 'millicent', 'naracoorte']),
    place('sa-yorke', 'Yorke Peninsula', 'South Australia', 'sa', 'AU', ['yorke peninsula', 'kadina', 'moonta', 'wallaroo']),
    place('sa-eyre', 'Eyre Peninsula', 'South Australia', 'sa', 'AU', ['eyre peninsula', 'port lincoln', 'whyalla', 'ceduna']),
    place('sa-flinders', 'Flinders Ranges', 'South Australia', 'sa', 'AU', ['flinders ranges', 'quorn', 'hawker']),
    place('sa-outback', 'Outback South Australia', 'South Australia', 'sa', 'AU', ['coober pedy', 'roxby downs', 'port augusta']),

    place('wa', 'All of Western Australia', 'Western Australia', 'au', 'AU', ['western australia', 'wa']),
    place('wa-perth', 'Perth', 'Western Australia', 'wa', 'AU', ['perth', 'fremantle', 'joondalup', 'rockingham', 'midland', 'armadale']),
    place('wa-peel', 'Peel', 'Western Australia', 'wa', 'AU', ['peel', 'mandurah', 'pinjarra']),
    place('wa-southwest', 'South West', 'Western Australia', 'wa', 'AU', ['bunbury', 'busselton', 'margaret river', 'manjimup', 'collie']),
    place('wa-great-southern', 'Great Southern', 'Western Australia', 'wa', 'AU', ['great southern', 'albany', 'denmark', 'katanning']),
    place('wa-wheatbelt', 'Wheatbelt', 'Western Australia', 'wa', 'AU', ['wheatbelt', 'northam', 'merredin', 'narrogin', 'moora']),
    place('wa-midwest', 'Mid West', 'Western Australia', 'wa', 'AU', ['mid west', 'geraldton', 'dongara', 'kalbarri']),
    place('wa-gascoyne', 'Gascoyne', 'Western Australia', 'wa', 'AU', ['gascoyne', 'carnarvon', 'exmouth', 'shark bay']),
    place('wa-goldfields', 'Goldfields', 'Western Australia', 'wa', 'AU', ['goldfields', 'kalgoorlie', 'leonora', 'esperance']),
    place('wa-pilbara', 'Pilbara', 'Western Australia', 'wa', 'AU', ['pilbara', 'karratha', 'port hedland', 'newman', 'tom price', 'paraburdoo', 'onslow']),
    place('wa-kimberley', 'Kimberley', 'Western Australia', 'wa', 'AU', ['kimberley', 'broome', 'kununurra', 'wyndham']),

    place('tas', 'All of Tasmania', 'Tasmania', 'au', 'AU', ['tasmania']),
    place('tas-hobart', 'Hobart', 'Tasmania', 'tas', 'AU', ['hobart', 'glenorchy']),
    place('tas-launceston', 'Launceston', 'Tasmania', 'tas', 'AU', ['launceston']),
    place('tas-northwest', 'North West', 'Tasmania', 'tas', 'AU', ['devonport', 'burnie', 'ulverstone', 'smithton']),
    place('tas-east', 'East Coast', 'Tasmania', 'tas', 'AU', ['st helens', 'bicheno', 'swansea']),
    place('tas-west', 'West Coast', 'Tasmania', 'tas', 'AU', ['strahan', 'zeehan']),

    place('nt', 'All of the Northern Territory', 'Northern Territory', 'au', 'AU', ['northern territory']),
    place('nt-darwin', 'Darwin', 'Northern Territory', 'nt', 'AU', ['darwin', 'palmerston']),
    place('nt-katherine', 'Katherine', 'Northern Territory', 'nt', 'AU', ['katherine']),
    place('nt-alice', 'Alice Springs', 'Northern Territory', 'nt', 'AU', ['alice springs']),
    place('nt-arnhem', 'Arnhem', 'Northern Territory', 'nt', 'AU', ['arnhem', 'nhulunbuy', 'jabiru']),
    place('nt-barkly', 'Barkly', 'Northern Territory', 'nt', 'AU', ['barkly', 'tennant creek']),

    place('act', 'Canberra', 'Australian Capital Territory', 'au', 'AU', ['canberra', 'australian capital territory']),

    place('nz', 'All of New Zealand', 'New Zealand', '', 'NZ'),
    place('nz-northland', 'All of Northland', 'Northland', 'nz', 'NZ', ['northland', 'whangarei']),
    place('nz-far-north', 'Far North', 'Northland', 'nz-northland', 'NZ', ['far north', 'kaitaia', 'kerikeri', 'paihia', 'kaikohe']),
    place('nz-auckland', 'Auckland', 'Auckland', 'nz', 'NZ', ['auckland', 'manukau', 'takapuna']),
    place('nz-waikato', 'All of Waikato', 'Waikato', 'nz', 'NZ', ['waikato', 'hamilton', 'cambridge', 'te awamutu', 'taupo', 'tokoroa']),
    place('nz-coromandel', 'Coromandel', 'Waikato', 'nz-waikato', 'NZ', ['coromandel', 'thames', 'whitianga']),
    place('nz-king-country', 'King Country', 'Waikato', 'nz-waikato', 'NZ', ['king country', 'te kuiti', 'taumarunui', 'otorohanga']),
    place('nz-bop', 'Bay of Plenty', 'Bay of Plenty', 'nz', 'NZ', ['bay of plenty', 'tauranga', 'rotorua', 'whakatane', 'te puke', 'mount maunganui']),
    place('nz-gisborne', 'All of Gisborne', 'Gisborne', 'nz', 'NZ', ['gisborne']),
    place('nz-east-cape', 'East Cape', 'Gisborne', 'nz-gisborne', 'NZ', ['east cape', 'ruatoria', 'tolaga bay']),
    place('nz-hawkes', "Hawke's Bay", "Hawke's Bay", 'nz', 'NZ', ["hawke's bay", 'hawkes bay', 'napier', 'hastings', 'waipukurau']),
    place('nz-taranaki', 'Taranaki', 'Taranaki', 'nz', 'NZ', ['taranaki', 'new plymouth', 'hawera']),
    place('nz-manawatu', 'Manawatū-Whanganui', 'Manawatū-Whanganui', 'nz', 'NZ', ['manawatu', 'manawatū', 'palmerston north', 'whanganui', 'wanganui', 'levin', 'feilding', 'taihape']),
    place('nz-wellington', 'All of Wellington', 'Wellington', 'nz', 'NZ', ['wellington', 'lower hutt', 'porirua']),
    place('nz-wairarapa', 'Wairarapa', 'Wellington', 'nz-wellington', 'NZ', ['wairarapa', 'masterton', 'martinborough', 'carterton', 'greytown']),
    place('nz-tasman', 'Tasman', 'Tasman', 'nz', 'NZ', ['motueka', 'takaka']),
    place('nz-nelson', 'Nelson', 'Nelson', 'nz', 'NZ', ['nelson']),
    place('nz-marlborough', 'Marlborough', 'Marlborough', 'nz', 'NZ', ['marlborough', 'blenheim', 'picton']),
    place('nz-west', 'West Coast', 'West Coast', 'nz', 'NZ', ['greymouth', 'hokitika', 'westport']),
    place('nz-canterbury', 'All of Canterbury', 'Canterbury', 'nz', 'NZ', ['christchurch', 'timaru', 'ashburton', 'rangiora', 'kaikoura', 'canterbury region']),
    place('nz-mackenzie', 'Mackenzie', 'Canterbury', 'nz-canterbury', 'NZ', ['mackenzie', 'tekapo', 'twizel', 'mount cook']),
    place('nz-otago', 'All of Otago', 'Otago', 'nz', 'NZ', ['otago', 'dunedin', 'oamaru']),
    place('nz-queenstown', 'Queenstown Lakes', 'Otago', 'nz-otago', 'NZ', ['queenstown', 'wanaka']),
    place('nz-central-otago', 'Central Otago', 'Otago', 'nz-otago', 'NZ', ['central otago', 'alexandra', 'cromwell', 'roxburgh']),
    place('nz-southland', 'All of Southland', 'Southland', 'nz', 'NZ', ['southland', 'invercargill']),
    place('nz-fiordland', 'Fiordland', 'Southland', 'nz-southland', 'NZ', ['fiordland', 'te anau', 'manapouri', 'milford sound'])
  ];

  const byId = Object.fromEntries(AREAS.map(area => [area.id, area]));

  function areaById(id) {
    return byId[id] || null;
  }

  function pattern(area) {
    if (area._re) return area._re;
    const parts = area.words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'));
    area._re = parts.length ? new RegExp('\\b(?:' + parts.join('|') + ')\\b', 'i') : /$^/;
    return area._re;
  }

  function matchedIds(text) {
    const ids = new Set();
    const body = String(text || '');
    for (const area of AREAS) {
      if (!area.words.length || !pattern(area).test(body)) continue;
      let cur = area;
      while (cur) {
        ids.add(cur.id);
        cur = cur.parent ? byId[cur.parent] : null;
      }
    }
    return ids;
  }

  function nzSource(source) {
    return /\brnz\b|radio new zealand/i.test(source || '');
  }

  function inArea(text, areaId, source) {
    const area = byId[areaId] || byId.au;
    const ids = matchedIds(text);
    const overseas = OVERSEAS.test(String(text || ''));
    const auPlace = [...ids].some(id => id !== 'au' && byId[id] && byId[id].country === 'AU');
    const nzPlace = [...ids].some(id => id !== 'nz' && byId[id] && byId[id].country === 'NZ');
    if (area.id === 'au') {
      if (nzPlace && !auPlace) return false;
      if (nzSource(source) && !auPlace) return false;
      if (overseas && !auPlace) return false;
      return true;
    }
    if (area.id === 'nz') return nzPlace || (nzSource(source) && !auPlace && !overseas);
    return ids.has(area.id);
  }

  function curated(items, areaId) {
    const area = byId[areaId] || byId.au;
    const local = items.filter(item => inArea(item.text, area.id, item.source));
    const parent = area.parent ? byId[area.parent] : null;
    if (local.length || !parent || parent.id === 'au' || parent.id === 'nz') {
      return { id: area.id, widened: false, from: '', items: local };
    }
    return {
      id: area.id,
      widened: true,
      from: parent.id,
      items: items.filter(item => inArea(item.text, parent.id, item.source))
    };
  }

  return { AREAS, areaById, matchedIds, inArea, curated };
});
