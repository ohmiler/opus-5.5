import { storage, escapeHTML } from './utils/helpers.js';

// Every section that can open as a window. `mount` wires up interactivity and returns a cleanup fn.

const PROJECTS = [
  ['Bubble Mail', 'E-mail that floats up and pops when read.', 'linear-gradient(135deg,#9fe7ff,#3a8dff)'],
  ['Liquid Player', 'An MP3 player shaped like a drop of water.', 'linear-gradient(135deg,#ffb6ec,#ff5fc8)'],
  ['GeoVillage', 'Build a homepage, get a neighbourhood.', 'linear-gradient(135deg,#d6ff8a,#39c52a)'],
  ['Pixel Pet', 'A tamagotchi that lives in your system tray.', 'linear-gradient(135deg,#fff3a0,#ffb13d)'],
  ['Chrome Chat', 'Instant messaging, but every message is shiny.', 'linear-gradient(135deg,#ffffff,#a9b8c9)'],
  ['Dial-Up Zen', 'Meditation app. Soundtrack: modem handshake.', 'linear-gradient(135deg,#c9b8ff,#6b4bff)'],
];

const TRACKS = [
  ['Aqua Dreams (Radio Edit)', '3:12', [[76, 1], [79, 1], [83, 1], [81, 1], [79, 1], [76, 1], [74, 2], [76, 1], [79, 1], [81, 2], [79, 2]]],
  ['Dial-Up Serenade', '4:04', [[64, 0.5], [67, 0.5], [71, 0.5], [74, 0.5], [72, 1], [71, 1], [67, 2], [69, 1], [71, 1], [64, 2]]],
  ['Millennium Bug Bounce', '2:59', [[72, 0.5], [72, 0.5], [79, 1], [77, 0.5], [76, 0.5], [74, 1], [72, 0.5], [74, 0.5], [76, 1], [72, 2]]],
  ['Screensaver Slowdance', '5:20', [[67, 2], [71, 2], [74, 2], [72, 1], [71, 1], [69, 4]]],
];

const FACTS = [
  'In 2000, a "gigabyte" was considered an irresponsible amount of storage.',
  'The average web page in 2000 contained 2.3 spinning GIFs and one guestbook.',
  'Translucent plastic was legally required on all computers from 1998 to 2002.*',
  'Your modem was singing to the internet. The internet sang back.',
  '"Under construction" was the most popular website on Earth.',
  'Screensavers existed to save screens. Nobody knows from what.',
  'Clicking "Start" to shut down made perfect sense to everyone.',
];

export const SECTIONS = {
  welcome: {
    title: 'welcome.txt', icon: '✉', width: 440, status: 'Read-only · 2 KB',
    html: `
      <h2>Hello, visitor!</h2>
      <p>You've booted into <b>Millennium OS</b> — the operating system from an alternate year 2000, where everything stayed shiny, translucent and a little bit silly.</p>
      <h3>Things to try</h3>
      <ul>
        <li>Drag &amp; <b>throw</b> anything on the desk</li>
        <li>Double-click folders, CDs and floppies</li>
        <li>Hover a CD. Click a star. Poke the smiley.</li>
        <li>Just start typing — the computer is listening</li>
        <li>Drag windows around. They stack.</li>
      </ul>
      <p>There are <b>5 secrets</b> hidden somewhere. The diamonds in the top-right corner keep score.</p>`,
  },

  about: {
    title: 'About', icon: '◉', width: 460, status: 'about.htm · Best viewed at 800×600',
    html: `
      <h2>About Millennium OS</h2>
      <p>Millennium OS was written in 1999 by four friends, one garage and an unreasonable amount of iridescent plastic.</p>
      <p>It never shipped. Some say the Y2K bug ate the master disk. Others say it was simply too fun for its own good.</p>
      <h3>Design principles</h3>
      <ul>
        <li>Every button should be delicious enough to lick.</li>
        <li>If it can be translucent, it must be translucent.</li>
        <li>Chrome is a feeling, not a finish.</li>
        <li>No object shall sit still when a user is watching.</li>
      </ul>
      <p style="opacity:.6">This page is a love letter to early-internet interfaces, rebuilt with modern real-time 3D.</p>`,
  },

  projects: {
    title: 'Projects', icon: '▣', width: 560, status: '6 object(s)',
    html: () => `
      <h2>Projects</h2>
      <p>Software from a future that got cancelled.</p>
      <div class="cards">${PROJECTS.map(([t, d, g]) => `
        <article class="card"><div class="card__thumb" style="--g:${g}"></div><div class="card__body"><b>${t}</b>${d}</div></article>`).join('')}
      </div>`,
  },

  guestbook: {
    title: 'Guestbook', icon: '✎', width: 440, status: 'Sign it! Pleeease!',
    html: `
      <div class="guest">
        <h2>Sign my guestbook!!</h2>
        <form>
          <input name="name" maxlength="24" placeholder="Your name / screen name" required autocomplete="off" />
          <textarea name="msg" maxlength="140" placeholder="Leave a message :)" required></textarea>
          <button class="gel-btn gel-btn--pink" type="submit">Sign ✦</button>
        </form>
        <ul class="guest__list"></ul>
      </div>`,
    mount(body, { sound, toasts }) {
      const seed = [
        { n: 'xX_sk8r_Xx', m: 'kewl site!!! the CDs spin lol' },
        { n: 'webmistress99', m: 'Love the translucent folders. Linking you from my webring <3' },
        { n: 'modem_whisperer', m: 'first!!!1' },
      ];
      const list = body.querySelector('.guest__list');
      const render = () => {
        const entries = [...storage.get('mos-guestbook', []), ...seed];
        list.innerHTML = entries.map((e) => `<li><b>${escapeHTML(e.n)}</b><br>${escapeHTML(e.m)}</li>`).join('');
      };
      render();
      body.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const entry = { n: String(f.get('name')).trim().slice(0, 24), m: String(f.get('msg')).trim().slice(0, 140) };
        if (!entry.n || !entry.m) return;
        storage.set('mos-guestbook', [entry, ...storage.get('mos-guestbook', [])].slice(0, 20));
        e.target.reset();
        render();
        sound.play('egg');
        toasts?.show('Thanks for signing! You are visitor #000' + (1337 + Math.floor(Math.random() * 99)), '✎');
      });
    },
  },

  mixtape: {
    title: 'Mixtape 2000.cda', icon: '♪', width: 420, status: 'CD Audio · 4 tracks',
    html: `
      <h2>Mixtape 2000</h2>
      <div class="viz" aria-hidden="true">${'<i></i>'.repeat(22)}</div>
      <ul class="tracks">${TRACKS.map(([t, d], i) => `<li><button data-i="${i}"><span class="n">0${i + 1}</span>${t}<span class="d">${d}</span></button></li>`).join('')}</ul>
      <p class="hint" style="opacity:.6;margin-top:10px">Tip: turn on sound (♪ in the tray) to hear the chiptunes.</p>`,
    mount(body, { sound }) {
      const bars = [...body.querySelectorAll('.viz i')];
      let playing = null, stop = () => {}, raf = 0, end = 0;
      const animate = () => {
        const on = playing && performance.now() < end;
        bars.forEach((b, i) => (b.style.height = on ? 12 + Math.abs(Math.sin(performance.now() / (120 + i * 13) + i)) * 85 + '%' : '8%'));
        if (on) raf = requestAnimationFrame(animate);
        else { playing?.classList.remove('is-playing'); playing = null; }
      };
      body.querySelector('.tracks').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        stop(); cancelAnimationFrame(raf);
        playing?.classList.remove('is-playing');
        const notes = TRACKS[+b.dataset.i][2];
        stop = sound.melody(notes, 160);
        playing = b; b.classList.add('is-playing');
        end = performance.now() + notes.reduce((s, n) => s + n[1], 0) * (60 / 160) * 1000;
        animate();
      });
      return () => { stop(); cancelAnimationFrame(raf); };
    },
  },

  cdrom: {
    title: 'Encyclopedia 2000', icon: '◎', width: 420, status: 'Disc 1 of 1 · Please do not eject',
    html: `
      <h2>Encyclopedia 2000</h2>
      <p>Fact of the moment:</p>
      <div class="fact"></div>
      <div class="btn-row"><button class="gel-btn" data-next>Next fact ▶</button></div>
      <p style="opacity:.5;font-size:16px;margin-top:12px">*citation needed</p>`,
    mount(body, { sound }) {
      let i = Math.floor(Math.random() * FACTS.length);
      const box = body.querySelector('.fact');
      const show = () => { box.textContent = FACTS[i % FACTS.length]; box.style.animation = 'none'; void box.offsetWidth; box.style.animation = ''; };
      show();
      body.querySelector('[data-next]').addEventListener('click', () => { i++; show(); sound.play('click'); });
    },
  },

  downloads: {
    title: 'Downloads', icon: '⇩', width: 420, status: 'Connected at 56.6 kbps',
    html: `
      <h2>Downloads</h2>
      <p>Totally legitimate, virus-free shareware.</p>
      <div class="dl" data-name="flying_toasters.scr"><b>flying_toasters.scr</b> — 1.2 MB<div class="meter"><i></i></div></div>
      <div class="dl" data-name="dancing_baby.avi"><b>dancing_baby.avi</b> — 4.8 MB<div class="meter"><i></i></div></div>
      <div class="dl" data-name="more_ram.exe"><b>more_ram.exe</b> — 640 KB<div class="meter"><i></i></div></div>
      <p class="dl-status" style="opacity:.7">Click a file to begin downloading.</p>`,
    mount(body, { sound }) {
      const status = body.querySelector('.dl-status');
      const timers = [];
      body.querySelectorAll('.dl').forEach((d) => {
        d.style.cursor = 'pointer';
        d.addEventListener('click', () => {
          if (d.dataset.busy) return;
          d.dataset.busy = 1;
          const bar = d.querySelector('.meter i');
          let v = 0;
          sound.play('click');
          const tick = () => {
            v += Math.random() * (v < 70 ? 9 : 1.2);
            bar.style.setProperty('--v', Math.min(v, 99) + '%');
            status.textContent = v < 70 ? `Estimated time remaining: ${Math.ceil((100 - v) * 0.7)} minutes` : 'Estimated time remaining: 3 years';
            if (v < 100) timers.push(setTimeout(tick, 220));
            else {
              bar.style.setProperty('--v', '100%');
              status.textContent = d.dataset.name === 'more_ram.exe' ? 'Download complete. You now have slightly more RAM (emotionally).' : `${d.dataset.name}: download complete! Double-click to… oh wait.`;
              sound.play('egg');
            }
          };
          tick();
        });
      });
      return () => timers.forEach(clearTimeout);
    },
  },

  computer: {
    title: 'My Computer', icon: '▤', width: 420, status: 'System Properties',
    html: `
      <h2>System Properties</h2>
      <dl class="spec">
        <dt>System</dt><dd>Millennium OS v2.000</dd>
        <dt>Processor</dt><dd>Pentium-ish III @ 733 MHz</dd>
        <dt>Case</dt><dd>Translucent Bondi Aqua</dd>
        <dt>Registered to</dt><dd>You, the Explorer</dd>
      </dl>
      <b>Memory</b><div class="meter"><i data-ram></i></div>
      <b>Fun</b><div class="meter"><i style="--v:100%"></i></div>
      <p>Tip: the computer can hear your keyboard. Try typing <kbd>help</kbd> then <kbd>Enter</kbd>.</p>`,
    mount(body) {
      const ram = body.querySelector('[data-ram]');
      const id = setInterval(() => ram.style.setProperty('--v', 40 + Math.random() * 50 + '%'), 700);
      ram.style.setProperty('--v', '64%');
      return () => clearInterval(id);
    },
  },

  error: {
    title: 'error.exe', icon: '⚠', width: 360, status: 'Error 2000',
    html: `
      <h2>⚠ Error 2000</h2>
      <p>Too much fun detected. The system may become delightful.</p>
      <div class="btn-row"><button class="gel-btn" data-ok>OK</button><button class="gel-btn gel-btn--ghost" style="color:#0a2a55" data-ok>Cancel</button></div>`,
    mount(body, { wm, win, sound }) {
      body.querySelectorAll('[data-ok]').forEach((b) => b.addEventListener('click', () => {
        const n = (wm.errorCount = (wm.errorCount || 0) + 1);
        sound.play('error');
        const r = win.el.getBoundingClientRect();
        wm.close(win.id);
        if (n % 4 !== 0) {
          const next = wm.open('error', { instance: true, origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 } });
          if (next) {
            next.x = r.left + 30; next.y = r.top + 26; wm.clampWin(next); wm.apply(next);
            next.body.querySelector('p').textContent = ['Are you sure?', 'Are you REALLY sure?', 'Fine. You win.'][Math.min(2, (n % 4) - 1)];
          }
        }
      }));
    },
  },

  secret: {
    title: 'secret.flp', icon: '★', width: 420, status: 'Hidden file · attrib +h',
    html: `
      <h2>You found the secret disk!</h2>
<pre class="ascii">   _________________
  |  ___________  |:|
  | |           | | |
  | |  THANK    | | |
  | |   YOU <3  | | |
  | |___________| | |
  |   _________   | |
  |  |   | [] |   | |
  |__|___|____|___|_|</pre>
      <p>Thanks for poking around. The best interfaces reward curiosity.</p>
      <p style="opacity:.7">Hidden behind the computer since 1999.</p>`,
  },
};

/** Items listed in the Start menu (keyboard-accessible entry to everything). */
export const START_MENU = [
  { id: 'welcome', icon: '✉', title: 'Welcome' },
  { id: 'about', icon: '◉', title: 'About' },
  { id: 'projects', icon: '▣', title: 'Projects' },
  '-',
  { id: 'mixtape', icon: '♪', title: 'Mixtape 2000' },
  { id: 'cdrom', icon: '◎', title: 'Encyclopedia' },
  { id: 'downloads', icon: '⇩', title: 'Downloads' },
  { id: 'guestbook', icon: '✎', title: 'Guestbook' },
  { id: 'computer', icon: '▤', title: 'My Computer' },
];
