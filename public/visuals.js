// Website-style visuals: palm logo, sunset-sea hero, photo-style covers for events.
const PALM = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
  <path d="M33 58c1-12 0-22-3-31"/><path d="M30 27c-6-6-15-6-21-1 7-1 13 1 17 5"/><path d="M30 27c-2-8-9-13-17-12 6 2 11 6 13 11"/>
  <path d="M30 27c3-8 11-12 19-10-7 1-12 5-15 10"/><path d="M30 27c7-4 16-2 21 4-7-2-13-2-18 0"/><path d="M30 27c1-7-2-14-7-18 2 6 3 11 2 17"/>
  <path d="M14 58h36M20 54c4-2 8-2 12 0s8 2 12 0"/></svg>`;

// Scenes per event type: [sky top, sky bottom, sea] — echoing the site's beach photography.
const SCENES = {
  wedding: ["#f3d9c4", "#e9b48f", "#5d7f93"], honeymoon: ["#ffb88a", "#f0756a", "#2f5b7a"], trip: ["#b9d9e8", "#f2e6cf", "#3e7fa0"],
  retreat: ["#cfe0d2", "#f1ead8", "#4f8a83"], corporate: ["#c9cfdc", "#eceae5", "#3d4f6e"], party: ["#2b2f45", "#7a4d72", "#1d2338"], other: ["#d8dde6", "#f3efe7", "#516a85"],
};
function scene(type, seed = "") {
  const [a, b, sea] = SCENES[type] || SCENES.other;
  const n = [...seed].reduce((s, c) => s + c.charCodeAt(0), 0), sunX = 25 + (n % 50), palmX = n % 2 ? 78 : 12;
  return `<svg viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="s${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="400" height="160" fill="url(#s${n})"/><circle cx="${sunX * 4}" cy="92" r="22" fill="#fff" opacity=".55"/>
    <path d="M0 98h400v62H0z" fill="${sea}"/><path d="M0 104c40-6 80 6 120 0s80-6 120 0 80 6 160 0" stroke="#fff" stroke-opacity=".35" fill="none"/>
    <path d="M0 132c60-10 120 8 200 0s140-12 200-2v30H0z" fill="#efe4cf"/>
    <g transform="translate(${palmX * 4} 30) scale(1.6)" stroke="#1d2029" stroke-opacity=".55" stroke-width="2" fill="none" stroke-linecap="round">
      <path d="M2 58c1-12 0-22-3-31"/><path d="M-1 27c-6-6-15-6-21-1 7-1 13 1 17 5"/><path d="M-1 27c3-8 11-12 19-10-7 1-12 5-15 10"/><path d="M-1 27c7-4 16-2 21 4-7-2-13-2-18 0"/><path d="M-1 27c-2-8-9-13-17-12 6 2 11 6 13 11"/></g></svg>`;
}
const cover = (e, tall) => `<div class="cover${tall ? " tall" : ""}">${e.coverUrl && /^https:\/\//.test(e.coverUrl) ? `<img src="${esc(e.coverUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : scene(e.type, e.id)}
  <div class="cover-txt"><span class="label">${esc(e.location || e.type || "Little Blue Door")}</span>${tall ? `<b>${esc(e.name)}</b>` : ""}</div></div>`;

document.head.insertAdjacentHTML("beforeend", `<style>
.palm{width:30px;height:30px;color:#fff;flex:none}.palm svg{width:100%;height:100%}
#lock .palm{width:64px;height:64px}
#lock{background:linear-gradient(180deg,rgba(29,32,41,.15),rgba(29,32,41,.85) 55%,#272b37),var(--hero) center/cover}
#lock h2{text-shadow:0 2px 18px rgba(0,0,0,.35)}
.cover{position:relative;height:110px;margin:-14px -14px 12px;overflow:hidden;background:var(--line)}
.cover.tall{height:190px;margin:-14px -16px 12px}
.cover svg,.cover img{width:100%;height:100%;object-fit:cover;display:block}
.cover-txt{position:absolute;inset:auto 0 0 0;padding:10px 14px;color:#fff;background:linear-gradient(transparent,rgba(20,22,30,.55))}
.cover-txt b{display:block;font:500 28px/1.1 "Cormorant Garamond",Georgia,serif;margin-top:2px}
.card.click .cover{border-bottom:1px solid var(--line)}
.wave{height:14px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 14'%3E%3Cpath d='M0 7c20-8 40 8 60 0s40-8 60 0' stroke='%23c9a96e' fill='none'/%3E%3C/svg%3E") center/120px 14px repeat-x;opacity:.6;margin:6px 0}
</style>`);

// Logo: swap the door for the palm everywhere.
document.querySelectorAll(".door").forEach((d) => { d.outerHTML = `<span class="palm">${PALM}</span>`; });
// Lock screen hero: a full-bleed sunset scene behind the sign-in (no external photos needed).
document.getElementById("lock").style.setProperty("--hero", `url("data:image/svg+xml,${encodeURIComponent(scene("honeymoon", "lbd").replace('preserveAspectRatio="xMidYMid slice"', 'preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"'))}")`);
