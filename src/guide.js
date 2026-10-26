'use strict';
const C = require('./color');
const { esc, round } = require('./util');
const { baseCss, slot, groundButtons } = require('./styles');
const { ROLES, COLOR_ROLES } = require('./tokens');

const escPre = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const pct = (x) => (x > 0 && x < 0.01 ? `${(x * 100).toFixed(1)}%` : `${Math.round(x * 100)}%`);
const ARROW = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHAPTERS = [
  ['typography', 'Typography', 'horizon'], ['fonts', 'Fonts', 'sky'], ['colour', 'Colour', 'object'], ['layout', 'Layout and spacing', 'grid'],
  ['components', 'Components', 'glass'], ['imagery', 'Imagery', 'detail'], ['voice', 'Voice and tone', 'street'], ['tokens', 'Design tokens', 'tokens'],
];

function guideCss() {
  return `
:root{--pad:clamp(16px,4vw,48px)}
html{scroll-behavior:smooth;scroll-padding-top:var(--nav-height)}
body{overflow-x:hidden}
.wrap{width:100%;max-width:calc(var(--layout-container) + 2 * var(--pad));margin:0 auto;padding:0 var(--pad)}
.page{position:relative;padding:clamp(96px,11vw,168px) 0 clamp(72px,9vw,140px);min-height:100svh;display:flex;flex-direction:column;justify-content:center}
.page.dark{background:var(--color-surface-inverse);color:var(--color-text-inverse)}
.page.alt{background:var(--color-surface)}
.kicker{display:block;font:600 var(--type-small-size)/1.3 var(--type-body-family);letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-muted)}
.dark .kicker,.on-image .kicker{color:color-mix(in srgb,var(--color-text-inverse) 72%,transparent)}
.muted{color:var(--color-text-muted)}.dark .muted{color:color-mix(in srgb,var(--color-text-inverse) 70%,transparent)}
.head{display:grid;gap:clamp(12px,1.6vw,20px);margin-bottom:clamp(36px,5vw,72px);max-width:880px}
.head.center{text-align:center;margin-inline:auto;justify-items:center}
h1,h2,h3,h4{overflow-wrap:break-word;text-wrap:balance}
p{text-wrap:pretty}
code,pre,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.86em}
.rule{border:0;border-top:1px solid var(--color-border);margin:clamp(40px,5vw,72px) 0}.dark .rule{border-color:color-mix(in srgb,var(--color-text-inverse) 18%,transparent)}
.grid{display:grid;gap:var(--layout-gutter)}
.g2{grid-template-columns:repeat(2,minmax(0,1fr))}.g3{grid-template-columns:repeat(3,minmax(0,1fr))}.g4{grid-template-columns:repeat(4,minmax(0,1fr))}
.split{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:clamp(24px,5vw,80px);align-items:center}
.split .media{aspect-ratio:4/5;border-radius:var(--card-radius)}
.tile{border-radius:var(--card-radius);padding:var(--card-padding);background:var(--color-surface)}
.dark .tile{background:color-mix(in srgb,var(--color-text-inverse) 7%,transparent)}
.alt .tile{background:var(--color-background)}
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;font-size:var(--type-small-size)}
th,td{text-align:left;padding:12px 14px 12px 0;border-bottom:1px solid var(--color-border);vertical-align:top}
.dark th,.dark td{border-color:color-mix(in srgb,var(--color-text-inverse) 16%,transparent)}
th{font-weight:600;color:var(--color-text-muted)}.dark th{color:color-mix(in srgb,var(--color-text-inverse) 65%,transparent)}
.reveal{transition:opacity 1s var(--motion-easing),transform 1s var(--motion-easing)}
html.js .reveal:not(.in){opacity:0;transform:translateY(28px)}
/* top bar */
.topbar{position:fixed;inset:0 0 auto 0;z-index:50;height:var(--nav-height);display:flex;align-items:center;color:var(--color-text-inverse);transition:background-color .5s var(--motion-easing),color .5s var(--motion-easing),box-shadow .5s var(--motion-easing)}
.topbar.solid{background:color-mix(in srgb,var(--color-background) 76%,transparent);backdrop-filter:blur(18px) saturate(1.6);-webkit-backdrop-filter:blur(18px) saturate(1.6);color:var(--color-text);box-shadow:0 1px 0 var(--color-border)}
.bar{display:flex;align-items:center;gap:16px}
.bar-title{font-weight:600;font-size:var(--nav-link-size);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-nav{display:flex;gap:clamp(12px,1.6vw,24px);margin-left:auto;font-size:var(--nav-link-size);font-weight:var(--nav-link-weight);text-transform:var(--nav-link-transform)}
.bar-nav a{text-decoration:none;opacity:.78;white-space:nowrap}.bar-nav a:hover{opacity:1}
.bar .unofficial{margin-left:auto}.bar-nav+.unofficial{margin-left:0}
/* cover */
.cover{min-height:100svh;color:var(--color-text-inverse);justify-content:flex-end;padding-bottom:28px;overflow:hidden}
.cover>.media{position:absolute;inset:0}
.cover-in{position:relative;z-index:2;display:grid;justify-items:start;gap:clamp(16px,2vw,24px);padding-top:30vh}
.cover h1{max-width:13ch}
.cover .lede{max-width:56ch;color:color-mix(in srgb,var(--color-text-inverse) 86%,transparent)}
.cover-row{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end;justify-content:space-between}
.glass{background:var(--card-glass-bg);backdrop-filter:var(--card-backdrop);-webkit-backdrop-filter:var(--card-backdrop);border-radius:var(--card-radius);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--color-text-inverse) 22%,transparent)}
.on-image .glass{background:color-mix(in srgb,var(--color-background) 18%,transparent);color:var(--color-text-inverse)}
.token-card{padding:var(--card-padding);min-width:min(320px,100%);display:grid;gap:10px}
.token-card .sw{height:64px;border-radius:calc(var(--card-radius) * .6);background:var(--color-action);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--color-text-inverse) 25%,transparent)}
.token-card .val{font-size:var(--type-h3-size);font-weight:var(--type-h3-weight);line-height:1.1}
.cover-foot{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;margin-top:clamp(40px,7vh,88px);font-size:var(--type-small-size);color:color-mix(in srgb,var(--color-text-inverse) 80%,transparent)}
/* overview */
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--layout-gutter);margin-top:clamp(32px,5vw,64px)}
.stat{display:grid;gap:8px;text-align:center;padding:clamp(20px,3vw,40px) 12px;border-top:1px solid var(--color-border)}
.stat b{font-family:var(--type-display-family);font-size:var(--type-h1-size);line-height:1;font-weight:var(--type-display-weight);letter-spacing:var(--type-display-tracking)}
.pages-list{display:flex;flex-wrap:wrap;gap:8px 18px;justify-content:center;margin-top:32px;font-size:var(--type-small-size)}
/* contents */
.ccard{position:relative;display:block;aspect-ratio:4/5;border-radius:var(--card-radius);overflow:hidden;color:var(--color-text-inverse);text-decoration:none;isolation:isolate}
.ccard>.media{position:absolute;inset:0}
.ccard .scrim{background:linear-gradient(180deg,color-mix(in srgb,var(--color-surface-inverse) 35%,transparent),transparent 35%,transparent 55%,color-mix(in srgb,var(--color-surface-inverse) 78%,transparent))}
.ccard .num,.ccard h3{text-shadow:0 1px 14px color-mix(in srgb,var(--color-surface-inverse) 55%,transparent)}
.ccard .num{position:absolute;z-index:2;top:18px;left:20px;font-weight:600;font-size:var(--type-small-size)}
.ccard .arr{position:absolute;z-index:2;top:14px;right:14px;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--button-translucent-bg);backdrop-filter:var(--button-translucent-backdrop);-webkit-backdrop-filter:var(--button-translucent-backdrop);transition:transform var(--motion-duration) var(--motion-easing)}
.ccard:hover .arr{transform:translate(2px,-2px)}
.ccard h3{position:absolute;z-index:2;left:20px;right:20px;bottom:18px}
.ccard .ai-label{bottom:auto;top:58px;right:14px}
/* rebuild */
.rb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--layout-gutter)}
.rb-panel{border-radius:var(--card-radius);padding:clamp(20px,3vw,40px);display:grid;gap:var(--layout-gutter);align-content:start}
.rb-light{background:var(--color-background);box-shadow:inset 0 0 0 1px var(--color-border)}
.rb-dark{background:var(--color-surface-inverse);color:var(--color-text-inverse)}
.rb-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:calc(var(--layout-gutter) * .75)}
.rb-button{display:inline-flex;align-items:center;justify-content:center;justify-self:start;height:var(--button-height);padding:0 var(--button-padding-x);border:0;border-radius:var(--button-radius);background:var(--button-bg);color:var(--button-fg);font-family:var(--type-body-family);font-size:var(--button-font-size);font-weight:var(--button-font-weight);letter-spacing:var(--button-tracking);text-transform:var(--button-transform);text-decoration:none}
.rb-card{background:var(--card-bg);color:var(--color-text);border-radius:var(--card-radius);box-shadow:var(--card-shadow);border:var(--card-border);overflow:hidden;display:flex;flex-direction:column}
.rb-card .media{aspect-ratio:4/3}
.rb-body{padding:var(--card-padding);display:grid;gap:6px}
.rb-body p{color:var(--color-text-muted);font-size:var(--type-small-size)}
/* typography */
.chapter{color:var(--color-text-inverse);overflow:hidden}
.chapter>.media{position:absolute;inset:0}
.chapter>.wrap{position:relative;z-index:2}
.specimen{padding:clamp(20px,3vw,40px);display:grid;gap:24px}
.on-image .glass.specimen{background:color-mix(in srgb,var(--color-background) 88%,transparent);color:var(--color-text)}
.specimen .btn-outline{color:var(--button-outline-fg);box-shadow:inset 0 0 0 var(--button-outline-border-width) var(--button-outline-border)}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip[aria-selected="true"]{background:var(--button-bg);color:var(--button-fg);box-shadow:none}
.panel[hidden]{display:none}
.panel{display:grid;gap:20px}
.spec-sample{overflow-wrap:anywhere;min-height:1em}
.spec-meta{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;font-size:var(--type-small-size)}
.spec-meta dt{opacity:.7}.spec-meta dd{font-weight:600}
/* fonts */
.fam{display:grid;gap:14px;align-content:start}
.aa{font-size:clamp(96px,14vw,200px);line-height:.9;letter-spacing:-.02em}
.bars{display:grid;gap:6px;font-size:var(--type-small-size)}
.bar-row{display:grid;grid-template-columns:48px 1fr 48px;gap:10px;align-items:center}
.bar-row i{display:block;height:6px;border-radius:3px;background:var(--color-accent)}
.install{font-size:var(--type-small-size);font-weight:600}
.charset{font-size:clamp(22px,3vw,40px);line-height:1.35;letter-spacing:.02em;overflow-wrap:anywhere}
.sizes{display:flex;flex-wrap:wrap;gap:8px}
.size-chip{padding:6px 12px;border-radius:999px;background:var(--color-background);font-size:var(--type-small-size)}
.scale td.s{white-space:nowrap}
.scale .smp{line-height:1;white-space:nowrap}
pre.code{background:var(--color-surface-inverse);color:var(--color-text-inverse);padding:20px;border-radius:calc(var(--card-radius) * .6);overflow:auto;max-height:520px;font-size:13px;line-height:1.55}
.dark pre.code{background:color-mix(in srgb,var(--color-text-inverse) 7%,transparent)}
/* colour */
.palette-bar{display:flex;height:clamp(96px,14vw,160px);border-radius:var(--card-radius);overflow:hidden;margin:24px 0 10px;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--color-text-inverse) 15%,transparent)}
.palette-bar span{min-width:6px}
.roles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:calc(var(--layout-gutter) * .75)}
.role{display:grid;gap:6px;font-size:var(--type-small-size)}
.role .sw{aspect-ratio:16/10;border-radius:calc(var(--card-radius) * .6);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--color-text-inverse) 18%,transparent)}
.role b{font-size:var(--type-body-size)}
.grad{height:120px;border-radius:var(--card-radius);background:var(--gradient-brand),var(--color-surface-inverse)}
.pair{display:inline-grid;place-items:center;width:56px;height:40px;border-radius:8px;font-weight:700}
details>summary{list-style:none;margin-top:24px}
details>summary::-webkit-details-marker{display:none}
.full{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:20px;font-size:12px}
.full span{display:block;height:56px;border-radius:8px;margin-bottom:6px;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--color-text-inverse) 18%,transparent)}
/* layout */
.facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--layout-gutter)}
.fact b{display:block;font-family:var(--type-display-family);font-size:var(--type-h1-size);font-weight:var(--type-display-weight);letter-spacing:var(--type-display-tracking);line-height:1}
.cols{display:grid;grid-template-columns:repeat(var(--layout-columns),minmax(0,1fr));gap:min(var(--layout-gutter),1.6vw);height:140px;max-width:var(--layout-container)}
.cols i{background:color-mix(in srgb,var(--color-accent) 22%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--color-accent) 55%,transparent);border-radius:4px}
.stair{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}
.stair div{display:grid;gap:6px;justify-items:start;font-size:11px}
.stair i{display:block;background:var(--color-accent);border-radius:2px;max-width:140px;max-height:140px}
.radii{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:16px}
.radii div{display:grid;gap:8px;font-size:var(--type-small-size)}
.radii i{display:block;height:110px;background:var(--color-surface-inverse)}
.bps{display:grid;gap:10px;margin-top:16px;font-size:var(--type-small-size)}
.bp{display:grid;grid-template-columns:64px 1fr;gap:4px 12px;align-items:center}
.bp i{display:block;height:10px;border-radius:5px;background:linear-gradient(90deg,var(--color-accent),color-mix(in srgb,var(--color-accent) 40%,transparent))}
.bp .muted{grid-column:2;font-size:11px}
.rhythm{display:flex;flex-direction:column;height:360px;width:120px;border-radius:12px;overflow:hidden;box-shadow:inset 0 0 0 1px var(--color-border)}
.rhythm i{display:block;min-height:3px}
.rh-light{background:var(--color-background)}.rh-dark{background:var(--color-surface-inverse)}.rh-image{background:var(--gradient-brand),var(--color-surface-inverse)}
.rhythm-wrap{display:flex;gap:32px;align-items:center;flex-wrap:wrap}
/* components */
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:var(--layout-gutter)}
.gtile{display:grid;gap:10px;font-size:var(--type-small-size)}
.ground{display:grid;place-items:center;min-height:150px;border-radius:var(--card-radius);padding:24px;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--color-text-inverse) 14%,transparent)}
.ground .btn{max-width:100%;overflow:hidden;text-overflow:ellipsis}
.navmock{display:flex;align-items:center;gap:20px;height:var(--nav-height);padding:0 20px;border-radius:calc(var(--card-radius) * .6);background:var(--color-background);color:var(--color-text);overflow:hidden}
.navmock .nb{position:absolute;inset:0;background:var(--nav-bg);backdrop-filter:var(--nav-backdrop)}
.navmock a{font-size:var(--nav-link-size);font-weight:var(--nav-link-weight);color:var(--nav-link-color);text-transform:var(--nav-link-transform);text-decoration:none;white-space:nowrap}
.navmock .links{display:flex;gap:20px;margin-left:auto;overflow:hidden}
.cards-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:var(--layout-gutter)}
.cvwrap{border-radius:var(--card-radius);padding:20px;display:grid}
.cv{min-height:250px;overflow:hidden;display:flex;flex-direction:column;color:var(--color-text)}
.cv .media{flex:1;min-height:140px}
.cv .cb{padding:max(var(--space-3, 12px),12px);display:grid;gap:6px}
.cv .ln{height:8px;border-radius:4px;background:color-mix(in srgb,currentColor 22%,transparent)}
.form{display:grid;gap:10px;max-width:520px}
.form label{font-size:var(--type-small-size);font-weight:600}
.form .row{display:flex;gap:10px;flex-wrap:wrap}
.inp{flex:1;min-width:200px;height:var(--input-height);padding:0 var(--input-padding-x);border-radius:var(--input-radius);border:var(--input-border-width) solid var(--input-border);background:var(--input-bg);color:var(--input-fg);font-family:var(--type-body-family);font-size:var(--input-font-size)}
.flag{display:inline-block;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;background:color-mix(in srgb,var(--color-accent) 22%,transparent);color:inherit}
/* imagery */
.mosaic{display:grid;grid-template-columns:2fr 1fr 1fr;grid-template-rows:240px 240px;gap:calc(var(--layout-gutter) * .6)}
.mosaic .media{border-radius:var(--card-radius)}
.mosaic .media:first-child{grid-row:span 2}
.mosaic .media:nth-child(4){grid-column:span 2}
.dl{display:grid;grid-template-columns:minmax(140px,1fr) 3fr;gap:12px 24px;font-size:var(--type-small-size)}
.dl dt{color:var(--color-text-muted);font-weight:600}.dark .dl dt{color:color-mix(in srgb,var(--color-text-inverse) 65%,transparent)}
.fb-note{font-size:var(--type-small-size);margin-top:12px}
/* voice */
.quotes{display:grid;gap:clamp(28px,4vw,56px)}
.quotes blockquote{display:grid;gap:10px}
.quotes cite{font-style:normal;font-size:var(--type-small-size);color:var(--color-text-muted)}
.rules{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--layout-gutter)}
.rcard{display:grid;gap:12px;align-content:start}
.rcard .n{font-family:var(--type-display-family);font-size:var(--type-h2-size);font-weight:var(--type-display-weight);line-height:1;color:var(--color-accent)}
/* tokens */
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px}
.code2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--layout-gutter)}
/* method */
.method li{padding:10px 0;border-bottom:1px solid var(--color-border);font-size:var(--type-small-size)}
footer.foot{padding:48px 0 64px;background:var(--color-surface-inverse);color:var(--color-text-inverse);font-size:var(--type-small-size)}
footer.foot .wrap{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center}
@media (max-width:1320px){.bar-nav{display:none}}
@media (max-width:1100px){.g4,.stats,.facts{grid-template-columns:repeat(2,minmax(0,1fr))}.spec-meta{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:860px){.split,.rb-grid,.code2,.rules{grid-template-columns:minmax(0,1fr)}.g3{grid-template-columns:repeat(2,minmax(0,1fr))}.mosaic{grid-template-columns:1fr 1fr;grid-template-rows:200px 160px 160px}.mosaic .media:first-child{grid-row:auto;grid-column:span 2}.mosaic .media:nth-child(4){grid-column:auto}}
@media (max-width:560px){.g3,.g2,.rb-cards{grid-template-columns:minmax(0,1fr)}.g4{grid-template-columns:repeat(2,minmax(0,1fr))}.spec-meta{grid-template-columns:repeat(2,minmax(0,1fr))}.bar-title{display:none}.dl{grid-template-columns:1fr}.cover h1{max-width:none}.page{min-height:auto}.cover{min-height:100svh}.ccard h3{font-size:var(--type-h4-size)}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation:none!important;transition:none!important}html.js .reveal:not(.in){opacity:1;transform:none}}
@keyframes kb{from{transform:scale(1.001)}to{transform:scale(1.08)}}
.cover>.media>.ph,.chapter>.media>.ph{animation:kb 24s var(--motion-easing) both alternate infinite}
`;
}

function guideJs() {
  return `
document.documentElement.classList.add('js');
addEventListener('DOMContentLoaded',function(){
  var bar=document.getElementById('topbar'),cover=document.getElementById('cover');
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(e){bar.classList.toggle('solid',!e[0].isIntersecting)},{rootMargin:'-64px 0px 0px 0px'}).observe(cover);
    var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{rootMargin:'0px 0px -8% 0px'});
    document.querySelectorAll('.reveal').forEach(function(el,i){el.style.transitionDelay=(i%4)*70+'ms';io.observe(el)});
  } else document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('in')});
  document.querySelectorAll('[role=tablist]').forEach(function(list){
    list.addEventListener('click',function(ev){var b=ev.target.closest('[role=tab]');if(!b)return;
      list.querySelectorAll('[role=tab]').forEach(function(t){t.setAttribute('aria-selected',t===b)});
      document.querySelectorAll('[data-panel]').forEach(function(p){p.hidden=p.getAttribute('data-panel')!==b.getAttribute('data-tab')});});
  });
  function text(id){return document.getElementById(id).textContent}
  function flash(b,m){var o=b.textContent;b.textContent=m;setTimeout(function(){b.textContent=o},1400)}
  document.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){
    var t=text(b.getAttribute('data-copy'));(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){flash(b,'Copied')},function(){
      var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');flash(b,'Copied')}catch(e){flash(b,'Select and copy')}ta.remove();});
  })});
  document.querySelectorAll('[data-download]').forEach(function(b){b.addEventListener('click',function(){
    var id=b.getAttribute('data-download'),a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([text(id)],{type:id==='tokens-json'?'application/json':'text/css'}));
    a.download=b.getAttribute('data-name');document.body.appendChild(a);a.click();a.remove();
  })});
  var ctx=document.createElement('canvas').getContext('2d'),probe='mmmmmmmmmmlli1WQ@#Aa';
  document.querySelectorAll('[data-family]').forEach(function(el){
    var f=el.getAttribute('data-family');
    var ok=['monospace','serif','sans-serif'].some(function(base){ctx.font='72px '+base;var w=ctx.measureText(probe).width;ctx.font='72px "'+f+'", '+base;return ctx.measureText(probe).width!==w});
    el.textContent=ok?'Installed on this device: the samples render in '+f+'.':'Not installed on this device: samples use the fallback stack.';
    el.setAttribute('data-installed',ok);
  });
});
`;
}

function renderGuide({ a, tokens, manifest, imagesDir, prompts, runlog, edition }) {
  const T = a.typography, R = a.colour.roles, L = a.layout, K = a.components, I = a.imagery, V = a.voice;
  const M = edition === 'hero' ? manifest : null;
  const S = (name, extra) => slot(name, M, extra);
  const B = esc(a.brand);
  const gb = groundButtons(a);
  const date = new Date().toISOString().slice(0, 10);
  const disclaimer = `Not affiliated with or endorsed by ${B}. Trademarks belong to their owners.`;
  const reveal = 'reveal';
  const roleRow = (r) => T.roles[r];
  const fmtPx = (n) => `${round(n, 1)}px`;
  const contrastOn = (hex) => {
    const ground = C.isDark(hex) ? R.background.hex : R.background.hex;
    const c1 = C.contrast(hex, R.background.hex), c2 = C.contrast(hex, R['surface-inverse'].hex);
    void ground;
    return `${round(c1, 2)}:1 on background, ${round(c2, 2)}:1 on inverse`;
  };

  // family cards: only the families behind the font tokens, so samples use variables
  const famTokens = [];
  for (const [v, role] of [['--font-display', 'display'], ['--font-heading', 'h1'], ['--font-body', 'body']]) {
    const f = T.roles[role].family;
    if (!famTokens.some((x) => x.family === f)) famTokens.push({ family: f, var: v, info: T.families.find((x) => x.family === f) || { share: 0, weights: [], generic: 'sans-serif', roles: [] } });
  }
  const extraFams = T.families.filter((f) => !famTokens.some((x) => x.family === f.family));

  const tabs = [['display', 'Display', 'display'], ['heading', 'Heading', 'h1'], ['subhead', 'Subhead', 'h3'], ['lead', 'Lead', 'lead'], ['body', 'Body', 'body']];
  const sampleFor = (role) => ({
    display: a.brand, h1: 'Measured, then rebuilt', h3: 'Every value comes from computed styles', lead: 'Sizes, weights, leading and tracking are taken from the live pages at 1440 and 390 pixels.',
    body: 'Body copy is set at its measured size, weight and line height. The same values are exported as tokens, and every sample on this page reads them back from those variables.',
  }[role]);

  const palette = a.colour.palette.slice(0, 12);
  const psum = palette.reduce((s, p) => s + p.score, 0) || 1;
  const ticks = L.breakpoints.map((b) => `<div class="bp"><span>${b.v}px</span><i style="width:${round((b.v / 1920) * 100, 2)}%"></i><span class="muted">${b.types.join(' / ')}-width · ${b.n}</span></div>`).join('');
  const bandTotal = L.bands.reduce((s, b) => s + b.h, 0) || 1;
  const nav = K.nav;
  const navLinks = nav ? nav.links.filter((l) => l && l.length < 24).slice(1, 7) : ['Product', 'Pricing', 'Company'];
  const tokensCss = tokens.css;
  const tokensJson = JSON.stringify(tokens.json, null, 1);
  const typeVars = Object.entries(T.typeVars || {});
  const phases = Object.entries(runlog.phases || {});

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${B} brand guidelines (unofficial analysis)</title>
<meta name="description" content="Unofficial, measured brand guide for ${esc(a.host)}. ${disclaimer}">
<style>${baseCss(a, tokensCss, M, imagesDir)}${guideCss()}</style>
<script>${guideJs()}</script>
</head>
<body>
<header class="topbar" id="topbar"><div class="wrap bar">
  <a class="logo-ph" href="#cover" title="Logo placeholder: measured ${nav && nav.logo ? `${nav.logo.w}×${nav.logo.h}px, ${nav.logo.color || 'n/a'}` : 'size not measured'}" aria-label="Logo placeholder">${nav && nav.logo && nav.logo.w >= 56 ? 'Logo' : ''}</a>
  <span class="bar-title">${B} brand guidelines</span>
  <nav class="bar-nav" aria-label="Sections">${CHAPTERS.slice(0, 7).map(([id, t]) => `<a href="#${id}">${t}</a>`).join('')}</nav>
  <span class="unofficial">Unofficial analysis</span>
</div></header>

<main>
<section class="page cover on-image" id="cover" data-section="Cover">
  ${S('hero')}
  <div class="scrim"></div>
  <div class="wrap cover-in">
    <span class="unofficial">Unofficial analysis</span>
    <h1 class="t-display">${B} brand guidelines</h1>
    <div class="cover-row">
      <div style="display:grid;gap:20px">
        <p class="t-lead lede">Measured from ${a.stats.pages} page${a.stats.pages > 1 ? 's' : ''} of ${esc(a.host)} at 1440 and 390 px on ${date}: ${a.overview.typefaces} typeface${a.overview.typefaces === 1 ? '' : 's'}, ${a.overview.colours} colours, a ${L.base}px spacing base.</p>
        <div><a class="${gb.dark} pill" href="#contents">View contents</a></div>
      </div>
      <aside class="glass token-card" aria-label="Token">
        <span class="kicker">Token</span>
        <div class="sw"></div>
        <code>--color-action</code>
        <div class="val">${R.action.hex}</div>
        <span class="mono" style="opacity:.8">${R.action.oklch}</span>
      </aside>
    </div>
  </div>
  <div class="wrap cover-foot"><span class="unofficial">Unofficial analysis</span><span>${disclaimer}</span></div>
</section>

<section class="page" id="overview" data-section="Overview">
  <div class="wrap">
    <div class="head center ${reveal}">
      <span class="kicker">Overview</span>
      <h2 class="t-h1">The ${B} interface, measured</h2>
      <p class="t-lead muted">${a.stats.elements.toLocaleString('en')} visible elements read from ${a.stats.pages} desktop page${a.stats.pages > 1 ? 's' : ''} and one 390 px pass. Repeated header and footer counts are counted once.</p>
    </div>
    <div class="stats">
      ${[[a.overview.typefaces, 'Typefaces'], [a.overview.colours, 'Colours in use'], [`${L.base}px`, 'Spacing base'], [a.overview.buttonVariants, 'Button variants']].map(([n, l]) => `<div class="stat ${reveal}"><b>${n}</b><span class="muted">${l}</span></div>`).join('')}
    </div>
    <div class="pages-list ${reveal}">${a.pages.map((p) => `<a href="${esc(p.url)}">${esc(p.path || '/')}</a>`).join('')}</div>
  </div>
</section>

<section class="page alt" id="contents" data-section="Contents">
  <div class="wrap">
    <div class="head ${reveal}"><span class="kicker">Contents</span><h2 class="t-h1">Contents</h2></div>
    <div class="grid g4">
      ${CHAPTERS.map(([id, t, s], i) => `<a class="ccard zoom ${reveal}" href="#${id}">${S(s)}<div class="scrim"></div><span class="num">${String(i + 1).padStart(2, '0')}</span><span class="arr">${ARROW}</span><h3 class="t-h3">${t}</h3></a>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="page" id="rebuild" data-section="Token rebuild test">
  <div class="wrap">
    <div class="head ${reveal}"><span class="kicker">Token rebuild test</span><h2 class="t-h1">Rebuilt from tokens only</h2>
    <p class="t-lead muted">The button and the cards below read only the variables in tokens.css. verify.js compares their computed styles with the token values.</p></div>
    <div class="rb-grid">
      ${['light', 'dark'].map((g) => `<div class="rb-panel rb-${g} ${reveal}">
        <span class="kicker">${g === 'light' ? 'Light ground: --color-background' : 'Dark ground: --color-surface-inverse'}</span>
        <a class="rb-button" href="#tokens" data-rebuild="button">Primary action</a>
        <div class="rb-cards">
          <article class="rb-card" data-rebuild="card">${S('sky')}<div class="rb-body"><h3 class="t-h4">Card title</h3><p>--card-bg, --card-radius, --card-padding, --card-shadow.</p></div></article>
          <article class="rb-card" data-rebuild="card">${S('object')}<div class="rb-body"><h3 class="t-h4">Second card</h3><p>Same tokens on the ${g} ground.</p></div></article>
        </div>
      </div>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="page chapter on-image" id="typography" data-section="Typography">
  ${S('horizon')}
  <div class="scrim"></div>
  <div class="wrap">
    <div class="head ${reveal}"><span class="kicker">01</span><h2 class="t-h1">Typography</h2>
    <p class="t-lead" style="opacity:.9">${T.clusters} size clusters reduced to eight roles. Scale ratio ${T.ratio}, nearest ${T.interval.name} (${T.interval.value}).</p></div>
    <div class="glass specimen ${reveal}">
      <div class="chips" role="tablist" aria-label="Type roles">
        ${tabs.map(([k, l], i) => `<button class="btn btn-outline chip" role="tab" data-tab="${k}" aria-selected="${i === 0}">${l}</button>`).join('')}
      </div>
      ${tabs.map(([k, , role], i) => { const r = roleRow(role); return `<div class="panel" role="tabpanel" data-panel="${k}"${i ? ' hidden' : ''}>
        <p class="spec-sample t-${role}">${esc(sampleFor(role))}</p>
        <dl class="spec-meta">
          <div><dt>Role</dt><dd>${role}${r.inferred ? ' <span class="flag">inferred</span>' : ''}</dd></div>
          <div><dt>Size</dt><dd>${fmtPx(r.mobile)} → ${fmtPx(r.size)}</dd></div>
          <div><dt>Weight</dt><dd>${r.weight}</dd></div>
          <div><dt>Leading</dt><dd>${r.lhRatio}</dd></div>
          <div><dt>Tracking</dt><dd>${r.trackingEm}em</dd></div>
          <div><dt>Family</dt><dd>${esc(r.family)}</dd></div>
        </dl></div>`; }).join('\n      ')}
    </div>
  </div>
</section>

<section class="page" id="fonts" data-section="Fonts">
  <div class="wrap">
    <div class="head ${reveal}"><span class="kicker">02</span><h2 class="t-h1">Fonts</h2>
    <p class="t-lead muted">Families are named from computed styles. Font files are not copied: samples use the name, then the fallback stack.</p></div>
    <div class="grid ${famTokens.length > 1 ? 'g' + Math.min(famTokens.length, 3) : 'g2'}">
      ${famTokens.map((f) => `<article class="tile fam ${reveal}">
        <div class="aa" style="font-family:var(${f.var})">Aa</div>
        <h3 class="t-h3">${esc(f.family)}</h3>
        <p class="muted">${f.info.generic} · ${pct(f.info.share)} of characters · ${(f.info.roles || []).join(', ') || 'no role'}</p>
        <div class="bars">${(f.info.weights || []).slice(0, 6).map((w) => `<div class="bar-row"><span>${w.weight}</span><i style="width:${Math.max(2, Math.round(w.share * 100))}%"></i><span>${pct(w.share)}</span></div>`).join('')}</div>
        <p class="install" data-family="${esc(f.family)}">Local install check needs JavaScript.</p>
      </article>`).join('\n      ')}
    </div>
    ${extraFams.length ? `<p class="muted ${reveal}" style="margin-top:20px">Also in use: ${extraFams.map((f) => `${esc(f.family)} (${pct(f.share)})`).join(', ')}.</p>` : ''}
    <hr class="rule">
    <div class="${reveal}"><span class="kicker">Character set, ${esc(T.roles.body.family)}</span>
    <p class="charset" style="font-family:var(--font-body);margin-top:14px">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz<br>0123456789 &amp;@#%?!()[]{}.,;:'"–—/€$£</p></div>
    <hr class="rule">
    <div class="${reveal}"><span class="kicker">Type scale, mobile → desktop</span>
    <div class="table-wrap" style="margin-top:16px"><table class="scale"><thead><tr><th>Role</th><th>Sample</th><th>Mobile → desktop</th><th>clamp()</th><th>Weight</th><th>Leading</th><th>Tracking</th><th>Share</th></tr></thead><tbody>
    ${ROLES.map((r) => { const x = T.roles[r]; return `<tr><td class="s">${r}${x.inferred ? ' <span class="flag">inferred</span>' : ''}</td><td><span class="smp t-${r}">Ag</span></td><td class="s">${fmtPx(x.mobile)} → ${fmtPx(x.size)}</td><td><code>${esc(x.clamp)}</code></td><td>${x.weight}</td><td>${x.lhRatio}</td><td>${x.trackingEm}em</td><td>${pct(x.share)}</td></tr>`; }).join('')}
    </tbody></table></div></div>
    <hr class="rule">
    <div class="grid g2">
      <div class="${reveal}"><span class="kicker">Sizes in use</span><div class="sizes" style="margin-top:14px">${T.sizesInUse.slice(0, 24).map((s) => `<span class="size-chip">${round(s.size, 1)}px</span>`).join('')}</div></div>
      <div class="${reveal}"><span class="kicker">Declared type variables</span>${typeVars.length ? `<pre class="code" style="margin-top:14px">${esc(typeVars.map(([k, v]) => `${k}: ${v};`).join('\n'))}</pre>` : '<p class="muted" style="margin-top:14px">No type variables are declared on :root.</p>'}</div>
    </div>
  </div>
</section>

<section class="page dark" id="colour" data-section="Colour">
  <div class="wrap">
    <div class="split">
      <div class="${reveal}">${S('object', 'zoom')}</div>
      <div class="${reveal}">
        <span class="kicker">03</span><h2 class="t-h1">Colour</h2>
        <p class="t-lead muted" style="margin-top:16px">Text weighted by characters, grounds by painted area. Hex values come from a 1px canvas, so oklch() and lab() resolve too.</p>
        <div class="palette-bar" role="img" aria-label="Proportional palette">${palette.map((p) => `<span title="${p.hex} ${pct(p.score / psum)}" style="background:${p.hex};flex-grow:${round(p.score / psum, 4)}"></span>`).join('')}</div>
        <p class="muted" style="font-size:var(--type-small-size)">Top ${palette.length} colours by combined usage.</p>
      </div>
    </div>
    <hr class="rule">
    <div class="roles">
      ${COLOR_ROLES.map((r) => `<div class="role ${reveal}"><div class="sw" style="background:var(--color-${r})"></div><b>${r}${R[r].inferred ? ' <span class="flag">inferred</span>' : ''}</b><code>${R[r].hex}</code><code>${R[r].oklch}</code><span class="muted">${contrastOn(R[r].hex)}</span><span class="muted">${pct(R[r].share)} · ${esc(R[r].source)}</span></div>`).join('\n      ')}
    </div>
    <hr class="rule">
    <div class="grid g2">
      <div class="${reveal}"><span class="kicker">Gradient${a.colour.brandGradient.inferred ? ' <span class="flag">inferred</span>' : ''}</span><div class="grad" style="margin:14px 0"></div><code style="overflow-wrap:anywhere">${esc(a.colour.brandGradient.css)}</code></div>
      <div class="${reveal}"><span class="kicker">Contrast of the most-read pairs</span>
        <div class="table-wrap"><table style="margin-top:8px"><thead><tr><th>Pair</th><th>Text / ground</th><th>Ratio</th><th>WCAG</th><th>Share</th></tr></thead><tbody>
        ${a.colour.contrastPairs.slice(0, 6).map((p) => `<tr><td><span class="pair" style="color:${p.fg};background:${p.bg}">Aa</span></td><td><code>${p.fg}</code> / <code>${p.bg}</code></td><td>${p.ratio}:1</td><td>${p.level}</td><td>${pct(p.share)}</td></tr>`).join('')}
        </tbody></table></div></div>
    </div>
    <details class="${reveal}"><summary class="btn btn-outline">Full palette (${a.colour.palette.length})</summary>
      <div class="full">${a.colour.palette.map((p) => `<div><span style="background:${p.hex}"></span><code>${p.hex}</code><br><span class="muted">text ${pct(p.text)} · bg ${pct(p.bg)}</span></div>`).join('')}</div>
    </details>
  </div>
</section>

<section class="page" id="layout" data-section="Layout and spacing">
  <div class="wrap">
    <div class="head ${reveal}"><span class="kicker">04</span><h2 class="t-h1">Layout and spacing</h2>
    <p class="t-lead muted">${pct(L.baseShare)} of padding, margin and gap values sit on the ${L.base}px grid.</p></div>
    <div class="facts">${[[`${L.base}px`, 'Spacing base'], [L.columns, `Columns${L.columnsInferred ? ' (inferred)' : ''}`], [`${round(L.gutter, 0)}px`, 'Gutter'], [`${round(L.container, 0)}px`, 'Container']].map(([n, l]) => `<div class="fact ${reveal}"><b>${n}</b><span class="muted">${l}</span></div>`).join('')}</div>
    <hr class="rule">
    <div class="${reveal}"><span class="kicker">Columns, --layout-columns at --layout-gutter</span><div class="cols" style="margin-top:16px">${Array.from({ length: L.columns }, () => '<i></i>').join('')}</div>
    <p class="muted" style="font-size:var(--type-small-size);margin-top:10px">Grid tracks observed: ${L.observedTracks.join(', ') || 'none'}.</p></div>
    <hr class="rule">
    <div class="grid g2">
      <div class="${reveal}"><span class="kicker">Spacing staircase</span><div class="stair" style="margin-top:16px">${L.scale.map((v, i) => `<div><i style="width:var(--space-${i + 1});height:var(--space-${i + 1})"></i><span>${v}</span></div>`).join('')}</div>
      <p class="muted" style="font-size:var(--type-small-size);margin-top:14px">Off grid: ${L.offGrid.slice(0, 10).map((x) => `${x.v}px`).join(', ') || 'none'}.</p></div>
      <div class="${reveal}"><span class="kicker">Radii</span><div class="radii" style="margin-top:16px">${['sm', 'md', 'lg', 'xl'].filter((n) => tokens.vars[`--radius-${n}`]).map((n) => `<div><i style="border-radius:var(--radius-${n})"></i><code>--radius-${n}</code><span class="muted">${tokens.vars[`--radius-${n}`].value}</span></div>`).join('')}<div><i style="border-radius:var(--radius-pill);height:56px"></i><code>--radius-pill</code><span class="muted">${pct(L.radii.pillShare)} of rounded boxes</span></div></div></div>
    </div>
    <hr class="rule">
    <div class="grid g2">
      <div class="${reveal}"><span class="kicker">Breakpoints, 0 to 1920px</span><div class="bps">${ticks}</div></div>
      <div class="${reveal}"><span class="kicker">Home page section rhythm</span><div class="rhythm-wrap" style="margin-top:16px"><div class="rhythm" role="img" aria-label="Light and dark bands">${L.bands.map((b) => `<i class="rh-${b.tone}" style="flex-grow:${round(b.h / bandTotal, 4)}"></i>`).join('')}</div>
      <p class="muted" style="font-size:var(--type-small-size);max-width:30ch">${L.bands.length} bands from top to bottom: ${L.bands.map((b) => b.tone).join(', ')}. Dark share ${pct(L.darkShare)}.</p></div></div>
    </div>
  </div>
</section>

<section class="page dark" id="components" data-section="Components">
  <div class="wrap">
    <div class="split">
      <div class="${reveal}">${S('glass', 'zoom')}</div>
      <div class="head ${reveal}" style="margin:0"><span class="kicker">05</span><h2 class="t-h1">Components</h2>
      <p class="t-lead muted">${K.buttons.length} button styles, ${K.cards.length} card styles and the navigation, each rebuilt from its measured values.</p></div>
    </div>
    <hr class="rule">
    <span class="kicker ${reveal}">Buttons on their grounds</span>
    <div class="gallery" style="margin-top:16px">
      ${K.buttons.slice(0, 6).map((b, i) => `<div class="gtile ${reveal}"><div class="ground" style="background:var(--button-v${i + 1}-ground)"><span class="btn bv-${i + 1}">${esc(b.labels[0] || 'Button')}</span></div>
        <span><b>${b.variant}</b> · ${b.h}px high · ${b.pill ? 'pill' : `${b.radius}px radius`} · ${b.fontSize}px/${b.weight} · ×${b.n}</span></div>`).join('\n      ')}
    </div>
    <hr class="rule">
    <span class="kicker ${reveal}">Navigation, ${nav ? `${nav.h}px, ${nav.sticky ? 'sticky' : 'static'}${nav.backdrop ? ', ' + esc(nav.backdrop) : ''}` : 'not measured'}</span>
    <div class="navmock ${reveal}" style="margin-top:16px;position:relative"><div class="nb"></div>
      <span class="logo-ph" style="position:relative" title="Logo placeholder">${nav && nav.logo && nav.logo.w >= 56 ? 'Logo' : ''}</span>
      <div class="links" style="position:relative">${navLinks.map((l) => `<a href="#components">${esc(l)}</a>`).join('')}</div>
      <span class="btn" style="position:relative;min-height:calc(var(--nav-height) * .6);padding-block:0">${esc((K.buttons.find((b) => b.inHeader) || {}).labels?.[0] || 'Get started')}</span>
    </div>
    <p class="muted ${reveal}" style="font-size:var(--type-small-size);margin-top:10px">Logo: dashed placeholder at the measured ${nav && nav.logo ? `${nav.logo.w}×${nav.logo.h}px in ${nav.logo.color || 'n/a'}` : 'size'}; the mark itself is not reproduced. See <a href="${esc(a.url)}">${esc(a.host)}</a>.</p>
    <hr class="rule">
    <span class="kicker ${reveal}">Cards</span>
    <div class="cards-g" style="margin-top:16px">
      ${K.cards.slice(0, 4).map((c, i) => `<div class="gtile ${reveal}"><div class="cvwrap" style="background:var(--card-v${i + 1}-ground)"><div class="cv cv-${i + 1}">${c.media !== 'none' ? S(['sky', 'object', 'detail', 'street'][i]) : ''}<div class="cb" style="padding:var(--card-v${i + 1}-padding)"><div class="ln" style="width:70%"></div><div class="ln" style="width:45%"></div></div></div></div>
        <span><b>${c.fill ? 'fill' : c.backdrop ? 'backdrop' : 'media'}</b> · radius ${c.radius}px · padding ${c.padding}px · media ${c.media}${c.shadow ? ' · shadow' : ''} · ×${c.n}</span></div>`).join('\n      ') || '<p class="muted">No cards measured.</p>'}
    </div>
    <hr class="rule">
    <div class="form ${reveal}"><span class="kicker">Form input ${K.input.inferred ? '<span class="flag">inferred</span>' : `(${K.input.count} measured)`}</span>
      <label for="demo-input">Email</label>
      <div class="row"><input id="demo-input" class="inp" type="email" placeholder="${esc(K.input.placeholder || 'name@example.com')}"><button class="${gb.dark}" type="button">Submit</button></div>
      <span class="muted" style="font-size:var(--type-small-size)">${K.input.h}px high · ${K.input.radius}px radius · ${K.input.borderW || 1}px border ${K.input.borderColor || ''}</span>
    </div>
  </div>
</section>

<section class="page" id="imagery" data-section="Imagery">
  <div class="wrap">
    <div class="head ${reveal}"><span class="kicker">06</span><h2 class="t-h1">Imagery</h2>
    <p class="t-lead muted">The site's images are described, not copied. ${M ? 'The photographs on this page are AI-generated from text prompts in the same style.' : 'Image slots in this edition use gradients built from the colour tokens.'}</p></div>
    <div class="mosaic ${reveal}">${['hero', 'detail', 'street', 'sky', 'object'].map((s) => S(s, 'zoom')).join('')}</div>
    ${M ? '' : '<p class="muted fb-note">Gradient fallbacks: no image in this edition.</p>'}
    <hr class="rule">
    <dl class="dl ${reveal}">
      <dt>Media measured</dt><dd>${I.count} items: ${I.kinds.map(([k, n]) => `${k} ${n}`).join(', ')}</dd>
      <dt>Formats</dt><dd>${I.formats.map(([k, n]) => `${esc(k)} ${n}`).join(', ') || 'none'}</dd>
      <dt>Crops</dt><dd>${I.crops.map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}</dd>
      <dt>Full bleed</dt><dd>${pct(I.fullBleedShare)} of media span the viewport</dd>
      <dt>object-fit</dt><dd>${I.fits.map(([k, n]) => `${esc(k)} ${n}`).join(', ')}</dd>
      <dt>Media share</dt><dd>${pct(I.areaShare)} of page area</dd>
      <dt>Alt-text themes</dt><dd>${I.altThemes.map(([w, n]) => `${esc(w)} (${n})`).join(', ') || 'no alt text'}; ${pct(I.altCoverage)} of media have alt text</dd>
      <dt>Source pages</dt><dd>${I.sources.map((s) => `<a href="${esc(s.url)}">${esc(s.path || '/')}</a> (${s.n})`).join(', ')}</dd>
    </dl>
  </div>
</section>

<section class="page alt" id="voice" data-section="Voice and tone">
  <div class="wrap">
    <div class="split">
      <div class="${reveal}">${S('street', 'zoom')}</div>
      <div class="${reveal}"><span class="kicker">07</span><h2 class="t-h1">Voice and tone</h2>
        <dl class="dl" style="margin-top:28px">
          <dt>Headlines</dt><dd>${V.stats.headlines}, median ${V.stats.headlineWords.median} words, mean ${V.stats.headlineWords.mean}</dd>
          <dt>Case</dt><dd>${Object.entries(V.stats.case).map(([k, v]) => `${k} ${pct(v)}`).join(', ')}</dd>
          <dt>You / we</dt><dd>${V.stats.you} / ${V.stats.we}</dd>
          <dt>Numbers</dt><dd>${pct(V.stats.numberShare)} of lines contain a figure</dd>
          <dt>"X, Y" headlines</dt><dd>${pct(V.stats.xyShare)}</dd>
          <dt>Exclamation marks</dt><dd>${V.stats.exclamations} in ${V.stats.words} words</dd>
          <dt>CTA first words</dt><dd>${V.stats.ctaVerbs.map(([v, n]) => `${esc(v)} (${n})`).join(', ') || 'none'}</dd>
        </dl>
      </div>
    </div>
    <hr class="rule">
    <div class="quotes">${V.quotes.map((q) => `<blockquote class="${reveal}" data-quote><p class="t-h2">“${esc(q.text)}”</p><cite><a href="${esc(q.url)}">${esc(new URL(q.url).pathname)}</a> · ${q.kind}</cite></blockquote>`).join('\n')}</div>
    <hr class="rule">
    <div class="rules">${V.rules.map((r) => `<article class="tile rcard ${reveal}" data-rule><span class="n">${String(r.n).padStart(2, '0')}</span><h3 class="t-h4">${esc(r.title)}</h3><p class="muted">${esc(r.detail)}</p></article>`).join('')}</div>
  </div>
</section>

<section class="page dark" id="tokens" data-section="Design tokens">
  <div class="wrap">
    <div class="split" style="margin-bottom:clamp(36px,5vw,72px)">
      <div class="${reveal}">${S('tokens', 'zoom')}</div>
      <div class="head ${reveal}" style="margin:0"><span class="kicker">08</span><h2 class="t-h1">Design tokens</h2>
      <p class="t-lead muted">${Object.keys(tokens.vars).length} CSS custom properties, and the same set as W3C design-tokens JSON with OKLCH next to hex.</p></div>
    </div>
    <div class="actions ${reveal}">
      <button class="${gb.dark}" data-copy="tokens-css">Copy CSS</button>
      <button class="btn btn-outline" data-copy="tokens-json">Copy JSON</button>
      <button class="btn btn-glass" data-download="tokens-css" data-name="tokens.css">Download tokens.css</button>
      <button class="btn btn-glass" data-download="tokens-json" data-name="tokens.json">Download tokens.json</button>
    </div>
    <div class="code2 ${reveal}"><pre class="code" id="tokens-css">${escPre(tokensCss)}</pre><pre class="code" id="tokens-json">${escPre(tokensJson)}</pre></div>
  </div>
</section>

<section class="page" id="method" data-section="Method">
  <div class="wrap">
    <div class="head ${reveal}"><span class="kicker">Method</span><h2 class="t-h1">Method</h2>
    <p class="t-lead muted">Playwright with ${esc(runlog.browser || 'Chrome')}, 1440×900 for every page and 390×844 for the home page. Each page is scrolled to load lazy content, then every visible element's computed style is read. Cookie and consent UI is excluded.</p></div>
    <div class="grid g2">
      <div class="${reveal}"><span class="kicker">Assumptions</span><ul class="method" style="margin-top:10px">${(runlog.assumptions || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li>None recorded.</li>'}</ul></div>
      <div class="${reveal}"><span class="kicker">Run log</span>
        <div class="table-wrap"><table style="margin-top:10px"><thead><tr><th>Phase</th><th>Time</th></tr></thead><tbody>${phases.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${(v.ms / 1000).toFixed(1)} s</td></tr>`).join('')}</tbody></table></div>
        <div class="table-wrap"><table style="margin-top:20px"><thead><tr><th>Page</th><th>Why</th><th>Elements</th></tr></thead><tbody>${a.pages.map((p) => `<tr><td><a href="${esc(p.url)}">${esc(p.path || '/')}</a></td><td>${p.role === 'home' ? 'home' : `score ${p.score}: ${(p.reasons || []).join(', ') || 'link'}`}</td><td>${p.elements}</td></tr>`).join('')}</tbody></table></div>
      </div>
    </div>
    <hr class="rule">
    <div class="${reveal}"><span class="kicker">Image prompts${M ? '' : ' (not used in this edition)'}</span>
      <div class="table-wrap"><table style="margin-top:10px"><thead><tr><th>Slot</th><th>Ratio</th><th>Use</th><th style="min-width:300px">Prompt</th></tr></thead><tbody>${prompts.slots.map((s) => `<tr><td>${s.slot}</td><td>${s.aspectRatio}</td><td>${esc(s.use)}</td><td>${esc(s.prompt)}</td></tr>`).join('')}</tbody></table></div>
    </div>
  </div>
</section>
</main>

<footer class="foot"><div class="wrap">
  <span class="unofficial">Unofficial analysis</span>
  <span>${disclaimer}</span>
  <span>Source: <a href="${esc(a.url)}">${esc(a.url)}</a> · Generated by reverse-brand on ${date}${M ? ' · Photographs are AI-generated images' : ''}</span>
</div></footer>
</body>
</html>
`;
  return html;
}

module.exports = { renderGuide, CHAPTERS };
