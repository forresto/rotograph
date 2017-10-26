'use strict';
let queue = [];
let knownUsers = {};
let loadedUsers = {};
let userCount = 0;
let fetching = 0;

function getID(id) {
  return document.getElementById(id);
}

function add(parent, e, vars) {
  let t = document.createElement(e);
  for (let k in vars) {
    t[k] = vars[k];
  }
  parent.appendChild(t);
  return t;
}

function addUser(portal) {
  if (loadedUsers[portal.dat]) {
    --fetching;
    return;
  }
  loadedUsers[portal.dat] = portal;
  let li = document.createElement('li');
  let a = add(li, 'a', {href: portal.dat});
  let img = add(a, 'img', {alt: portal.name});

  let imgbase = new URL(portal.dat).hostname;
  img.src = `dat://${imgbase}/media/content/icon.svg`;
  add(a, 'br');
  a.innerHTML += '@' + portal.name;

  getID('userlist').appendChild(li);
  ++userCount;
  getID('user-count').innerHTML = userCount;
  --fetching;
  getID('fetch-count').innerHTML = fetching;

  // Rotolist hack
  window.data = loadedUsers;
  updateGraph();
}

function cleanURL(url) {
  url = url.trim();
  while (url[url.length - 1] == '/') {
    url = url.slice(0, -1);
  }
  return url + '/';
}

async function loadSite(url, direct) {
  if (loadedUsers[url]) return;
  try {
    ++fetching;
    getID('fetch-count').innerHTML = fetching;
    let archive = new DatArchive(url);
    let data = await archive.readFile('/portal.json');
    let portal = JSON.parse(data);
    addUser(portal);
    if (direct) {
      for (let i = 0; i < portal.port.length; ++i) {
        let p = cleanURL(portal.port[i]);
        if (!knownUsers[p]) {
          knownUsers[p] = true;
          queue.push(p);
        }
      }
    }
  } catch (err) {
    console.log(err);
    --fetching;
    getID('fetch-count').innerHTML = fetching;
  }
}

function focusUser(url) {
  if (!window.DatArchive) return;
  if (!loadedUsers[url]) {
    loadSite(url, true);
  } else {
    const {port} = loadedUsers[url];
    port.forEach(url => {
      let p = cleanURL(url);
      if (!knownUsers[p]) {
        knownUsers[p] = true;
        queue.push(p);
      }
    });
  }
}

function tick() {
  if (queue.length > 0) {
    let url = queue.shift();
    loadSite(url);
  }
  requestAnimationFrame(tick);
}

async function main() {
  if (!window.DatArchive) {
    // non-Beaker
    getID('root-url').disabled = true;
    getID('go').disabled = true;
    return;
  }
  getID('discover-form').onsubmit = e => {
    // Rotograph hack
    window.data = {};
    updateGraph();

    e.preventDefault();
    queue = [];
    knownUsers = {};
    loadedUsers = {};
    userCount = 0;
    getID('user-count').innerHTML = '0';
    getID('userlist').innerHTML = '';
    const url = cleanURL(getID('root-url').value);
    focusUser(url);
  };
  tick();
}

main();
