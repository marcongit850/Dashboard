// Marketing homepage function spliced into an undeployed Cloudflare Worker
// version of "tango" (myhoadashboard.com). This file is not imported by the
// Team HQ worker in this repository.
// Preview: https://homepage-tango.352marc.workers.dev
function productPage(state = {}) {
  const code = state.code ?? "";
  const codeError = state.codeError ? `<p class="mhd-alert" role="alert">${esc(state.codeError)}</p>` : "";
  const values = state.contactValues ?? { name: "", email: "", neighborhood: "", message: "" };
  const sent = state.contactSent ? `<p class="mhd-ok" role="status">Your message was sent.</p>` : "";
  const error = state.contactError ? `<p class="mhd-alert" role="alert">${esc(state.contactError)}</p>` : "";
  const contactStatus = `${sent}${error}`;
  return `<style>
  body:has(.mhd) { background: #fff; }
  body:has(.mhd) main { padding-bottom: 0; }
  .mhd {
    --navy: #071a33;
    --navy-2: #10284a;
    --ink: #10233f;
    --muted: #3c5168;
    --blue: #2f6fed;
    --blue-d: #1d4fbe;
    --line: #d5e0ec;
    --mist: #f4f7fb;
    --card: #0b2144;
    color: var(--ink);
    background: #fff;
    font-family: "DM Sans", "Segoe UI", system-ui, sans-serif;
    font-size: 1.125rem;
    line-height: 1.55;
  }
  .mhd * { box-sizing: border-box; }
  .mhd h1, .mhd h2, .mhd .mhd-serif {
    font-family: "Instrument Serif", Georgia, "Iowan Old Style", Palatino, serif;
    font-weight: 400;
    letter-spacing: -0.02em;
    line-height: 1.08;
    margin: 0;
  }
  .mhd h3, .mhd p { margin: 0; }
  .mhd a { color: inherit; }
  .mhd-wrap { width: min(1160px, calc(100% - 2.5rem)); margin: 0 auto; }
  .mhd-kicker {
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin: 0 0 0.85rem;
  }
  .mhd-btn, .mhd button.mhd-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 3.15rem;
    padding: 0.75rem 1.25rem;
    border-radius: 999px;
    background: var(--blue);
    color: #fff;
    border: 2px solid var(--blue);
    font: 700 1.05rem/1 "DM Sans", "Segoe UI", system-ui, sans-serif;
    text-decoration: none;
    cursor: pointer;
    box-shadow: none;
  }
  .mhd-btn:hover, .mhd button.mhd-btn:hover { background: var(--blue-d); border-color: var(--blue-d); color: #fff; }
  .mhd-btn.ghost {
    background: transparent;
    color: #fff;
    border-color: rgba(255,255,255,.85);
  }
  .mhd-btn.ghost:hover { background: #fff; color: var(--navy); border-color: #fff; }
  .mhd a:focus-visible, .mhd button:focus-visible, .mhd summary:focus-visible, .mhd input:focus-visible, .mhd textarea:focus-visible {
    outline: 3px solid #f5c542;
    outline-offset: 3px;
  }
  .mhd-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0,0,0,0);
    border: 0;
  }

  .mhd-top { background: var(--navy); color: #fff; position: sticky; top: 0; z-index: 30; }
  .mhd-bar {
    display: flex;
    align-items: center;
    gap: 1rem 1.4rem;
    min-height: 4.75rem;
    padding: 0.7rem 0;
  }
  .mhd-brand {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    color: #fff;
    text-decoration: none;
    font-weight: 750;
    font-size: 1.12rem;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }
  .mhd-brand svg { width: 2rem; height: 2rem; flex: 0 0 auto; }
  .mhd-nav { margin-left: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem 1.15rem; }
  .mhd-nav a { color: #fff; text-decoration: none; font-weight: 650; font-size: 1.02rem; }
  .mhd-nav a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
  .mhd-nav a.mhd-btn { text-decoration: none; padding: 0.62rem 1.05rem; min-height: 2.8rem; font-size: 1rem; }
  .mhd-nav a.mhd-btn:hover { text-decoration: none; }

  .mhd-hero {
    position: relative;
    color: var(--navy);
    background: #d7ecf8 url("/mhd/hero.jpg") center / cover no-repeat;
    isolation: isolate;
  }
  .mhd-hero::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(255,255,255,.88) 0%, rgba(255,255,255,.72) 34%, rgba(255,255,255,.28) 58%, rgba(255,255,255,0) 78%);
    z-index: -1;
  }
  .mhd-hero .mhd-kicker { color: #1d4fbe; }
  .mhd-hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.92fr) minmax(300px, 1.08fr);
    gap: 1.5rem 2rem;
    align-items: end;
    padding: 3.1rem 0 2.2rem;
  }
  .mhd-hero-copy { max-width: 38rem; align-self: center; }
  .mhd-hero h1 {
    font-size: clamp(2.85rem, 5vw, 4.45rem);
    line-height: 1.02;
    letter-spacing: -0.034em;
    color: #071a33;
    max-width: 11em;
  }
  .mhd-hero h1 span { display: block; }
  .mhd-hero .mhd-lead { margin-top: 1rem; max-width: 34rem; font-size: 1.24rem; line-height: 1.45; color: #1b334c; }
  .mhd-hero-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem; }
  .mhd-hero .mhd-btn.ghost {
    background: #fff;
    color: var(--navy);
    border-color: #b7c9de;
  }
  .mhd-hero .mhd-btn.ghost:hover { background: var(--navy); color: #fff; border-color: var(--navy); }
  .mhd-hero-copy .mhd-card { margin-top: 1.25rem; box-shadow: 0 16px 40px rgba(16, 42, 74, 0.16); }
  .mhd-hero-stage { position: relative; min-height: 430px; align-self: end; }
  .mhd-hero-stage .mhd-laptop { width: min(100%, 560px); }
  .mhd-hero-stage .mhd-screen { min-height: 292px; }
  .mhd-hero-stage .mhd-phone { width: 148px; left: 0; bottom: 0; }
  .mhd-card {
    background: #fff;
    color: var(--ink);
    border-radius: 1.35rem;
    padding: 1.6rem 1.5rem 1.35rem;
    box-shadow: 0 18px 50px rgba(4, 16, 36, 0.28);
  }
  .mhd-card-icon {
    width: 2.7rem;
    height: 2.7rem;
    border-radius: 0.8rem;
    display: grid;
    place-items: center;
    background: #e8f0ff;
    color: var(--blue);
    margin-bottom: 0.85rem;
  }
  .mhd-card-icon svg { width: 1.45rem; height: 1.45rem; }
  .mhd-card h2 { font-size: 2rem; color: var(--navy); }
  .mhd-card .mhd-card-copy { color: var(--muted); margin: 0.45rem 0 1rem; font-size: 1.05rem; }
  .mhd-card input {
    width: 100%;
    min-height: 3.25rem;
    border: 1.5px solid #c9d6e6;
    border-radius: 0.85rem;
    padding: 0.7rem 0.95rem;
    font: 500 1.125rem/1.3 "DM Sans", "Segoe UI", system-ui, sans-serif;
    color: var(--ink);
    background: #fff;
  }
  .mhd-card input::placeholder { color: #6d7f93; }
  .mhd-card button.mhd-btn { width: 100%; margin-top: 0.75rem; border-radius: 0.85rem; }
  .mhd-lock {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    margin: 0.85rem 0 0;
    color: var(--muted);
    font-size: 0.98rem;
  }
  .mhd-lock svg { width: 1rem; height: 1rem; }
  .mhd-alert {
    background: #fff4e5;
    color: #6d3d08;
    border-radius: 0.7rem;
    padding: 0.7rem 0.85rem;
    margin: 0 0 0.75rem;
    font-size: 1rem;
  }

  .mhd-show { padding: 4.5rem 0 1.5rem; background: #fff; }
  .mhd-show-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
    gap: 2rem 2.5rem;
    align-items: center;
  }
  .mhd-show h2 { font-size: clamp(2.4rem, 4vw, 3.5rem); color: var(--navy); max-width: 12ch; }
  .mhd-show .mhd-prose { margin-top: 1rem; color: var(--muted); font-size: 1.15rem; max-width: 34rem; }
  .mhd-kicker.blue { color: var(--blue); }

  .mhd-devices { position: relative; min-height: 420px; }
  .mhd-laptop {
    width: min(100%, 640px);
    margin-left: auto;
    background: #1c2430;
    border-radius: 0.9rem 0.9rem 0.4rem 0.4rem;
    padding: 0.55rem 0.55rem 0;
    box-shadow: 0 22px 50px rgba(16, 35, 63, 0.18);
  }
  .mhd-screen {
    background: #f4f7fb;
    border-radius: 0.45rem;
    overflow: hidden;
    display: grid;
    grid-template-columns: 148px 1fr;
    min-height: 340px;
    color: var(--ink);
  }
  .mhd-side { background: #fff; border-right: 1px solid var(--line); padding: 0.75rem 0.6rem; }
  .mhd-side strong { display: block; font-size: 0.72rem; color: var(--navy); margin: 0 0 0.55rem; }
  .mhd-side a, .mhd-side span {
    display: block;
    font-size: 0.72rem;
    color: #4a5d73;
    text-decoration: none;
    padding: 0.28rem 0.35rem;
    border-radius: 0.35rem;
  }
  .mhd-side .on { background: #e7f0ff; color: var(--blue-d); font-weight: 700; }
  .mhd-app { padding: 0.75rem 0.8rem 0.9rem; }
  .mhd-app h3 { font-family: "DM Sans", "Segoe UI", system-ui, sans-serif; font-weight: 750; font-size: 1rem; letter-spacing: 0; color: var(--navy); }
  .mhd-app .who { color: var(--muted); font-size: 0.72rem; margin-top: 0.1rem; }
  .mhd-metrics { display: grid; grid-template-columns: 1.2fr 0.8fr 0.9fr; gap: 0.4rem; margin-top: 0.55rem; }
  .mhd-metric { background: #fff; border: 1px solid var(--line); border-radius: 0.45rem; padding: 0.4rem 0.45rem; }
  .mhd-metric b { display: block; font-size: 0.95rem; color: var(--navy); }
  .mhd-metric span { font-size: 0.65rem; color: var(--muted); }
  .mhd-metric.good { background: #e7f6ee; border-color: #c9ead8; }
  .mhd-note-list { margin-top: 0.45rem; display: grid; gap: 0.3rem; }
  .mhd-note {
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 0.4rem;
    padding: 0.35rem 0.45rem;
    font-size: 0.68rem;
    color: #31465d;
  }
  .mhd-note b { color: var(--navy); }
  .mhd-base { height: 0.7rem; background: #d5dbe3; border-radius: 0 0 0.7rem 0.7rem; margin: 0 -0.2rem; }
  .mhd-phone {
    position: absolute;
    left: 0;
    bottom: 0.4rem;
    width: 168px;
    background: #111;
    border-radius: 1.15rem;
    padding: 0.4rem;
    box-shadow: 0 16px 36px rgba(16, 35, 63, 0.25);
  }
  .mhd-phone-screen { background: #f7f9fc; border-radius: 0.85rem; overflow: hidden; min-height: 280px; padding: 0.55rem 0.5rem 0.7rem; }
  .mhd-phone-screen strong { display: block; font-size: 0.78rem; color: var(--navy); }
  .mhd-phone-screen .who { font-size: 0.62rem; color: var(--muted); }
  .mhd-phone .mhd-metric { margin-top: 0.4rem; }
  .mhd-phone .mhd-note { margin-top: 0.35rem; }

  .mhd-audiences { padding: 1.2rem 0 3.5rem; background: #fff; }
  .mhd-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  .mhd-aud {
    background: var(--card);
    color: #fff;
    border-radius: 1.15rem;
    padding: 1.45rem 1.3rem 1.3rem;
    min-height: 15rem;
  }
  .mhd-aud h3 { font-family: "DM Sans", "Segoe UI", system-ui, sans-serif; font-weight: 750; font-size: 1.35rem; letter-spacing: 0; margin: 0.85rem 0 0.4rem; }
  .mhd-aud p { color: #d5e2f2; font-size: 1.05rem; }
  .mhd-aud a { display: inline-block; margin-top: 0.9rem; color: #fff; font-weight: 700; }
  .mhd-bubble {
    width: 2.8rem;
    height: 2.8rem;
    border-radius: 999px;
    display: grid;
    place-items: center;
  }
  .mhd-bubble svg { width: 1.4rem; height: 1.4rem; }
  .mhd-bubble.blue { background: #2f6fed; }
  .mhd-bubble.green { background: #1f9d6a; }
  .mhd-bubble.peach { background: #e07a4c; }
  .mhd-bubble.lilac { background: #7c6ad6; }
  .mhd-bubble.gold { background: #d89a2b; }
  .mhd-bubble.rose { background: #d45b78; }

  .mhd-how { background: var(--mist); padding: 4rem 0; }
  .mhd-how-grid { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 1.5rem 2rem; align-items: center; }
  .mhd-how h2 { font-size: clamp(2.3rem, 4vw, 3.3rem); color: var(--navy); max-width: 16ch; }
  .mhd-how .mhd-prose { margin: 0.8rem 0 1.3rem; color: var(--muted); max-width: 38rem; }
  .mhd ol, .mhd ul, .mhd-steps { list-style: none; margin: 0; padding: 0; }
  .mhd-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.8rem; }
  .mhd-step h3 { font-family: "DM Sans", "Segoe UI", system-ui, sans-serif; font-weight: 750; font-size: 1.15rem; letter-spacing: 0; margin: 0.35rem 0; color: var(--navy); }
  .mhd-step p { color: var(--muted); font-size: 1rem; }
  .mhd-num { color: var(--blue); font-weight: 800; font-size: 0.95rem; letter-spacing: 0.04em; }
  .mhd-photo {
    position: relative;
    border-radius: 1.1rem;
    min-height: 280px;
    overflow: hidden;
    background: #0e3a55 url("/tango-mar-boardwalk.png") center / cover no-repeat;
    color: #fff;
    display: flex;
    align-items: flex-end;
    padding: 1.3rem;
    box-shadow: 0 16px 40px rgba(16, 35, 63, 0.15);
  }
  .mhd-photo::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(6,20,40,.05), rgba(6,20,40,.62));
  }
  .mhd-photo p { position: relative; font-family: "Instrument Serif", Georgia, serif; font-size: clamp(1.7rem, 2vw, 2.15rem); line-height: 1.15; margin: 0; }

  .mhd-features { background: #fff; padding: 4rem 0 3.5rem; }
  .mhd-features-head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-end; margin-bottom: 1.4rem; }
  .mhd-features h2 { font-size: clamp(2.3rem, 4vw, 3.3rem); color: var(--navy); }
  .mhd-features-head a { color: var(--blue-d); font-weight: 750; white-space: nowrap; }
  .mhd-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.9rem; }
  .mhd-feat {
    border: 1px solid var(--line);
    border-radius: 1rem;
    padding: 1.15rem 1.1rem 1.15rem;
    background: #fff;
    min-height: 11.5rem;
  }
  .mhd-feat h3 { font-family: "DM Sans", "Segoe UI", system-ui, sans-serif; font-weight: 750; font-size: 1.2rem; letter-spacing: 0; margin: 0.75rem 0 0.35rem; color: var(--navy); }
  .mhd-feat p { color: var(--muted); font-size: 1.02rem; }

  .mhd-faq { background: #fff; padding: 1rem 0 4rem; }
  .mhd-faq h2 { font-size: clamp(2.4rem, 4vw, 3.4rem); color: var(--navy); margin-bottom: 1rem; }
  .mhd-faq-list { display: grid; gap: 0.75rem; max-width: 920px; }
  .mhd-faq details { border: 1px solid #cfdced; border-radius: 0.95rem; background: #fff; padding: 0.25rem 1.15rem; }
  .mhd-faq summary {
    cursor: pointer;
    list-style: none;
    font-size: 1.45rem;
    font-weight: 700;
    line-height: 1.3;
    padding: 0.95rem 2.2rem 0.95rem 0;
    position: relative;
    color: var(--navy);
  }
  .mhd-faq summary::-webkit-details-marker { display: none; }
  .mhd-faq summary::marker { content: ""; }
  .mhd-faq summary::after {
    content: "";
    position: absolute;
    right: 0.2rem;
    top: 1.35rem;
    width: 0.55rem;
    height: 0.55rem;
    border-right: 2.5px solid var(--navy);
    border-bottom: 2.5px solid var(--navy);
    transform: rotate(45deg);
  }
  .mhd-faq details[open] summary::after { transform: rotate(-135deg); top: 1.5rem; }
  .mhd-faq .ans { color: var(--muted); padding: 0 0 1rem; font-size: 1.12rem; }
  .mhd-faq .ans a { color: var(--blue-d); font-weight: 700; }

  .mhd-cta {
    position: relative;
    color: #fff;
    background: #12324a url("/tango-mar-dunes.webp") center / cover no-repeat;
    isolation: isolate;
  }
  .mhd-cta::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(6,18,36,.72), rgba(6,18,36,.35));
    z-index: -1;
  }
  .mhd-cta-inner { padding: 4.2rem 0; max-width: 40rem; }
  .mhd-cta h2 { font-size: clamp(2.5rem, 5vw, 3.8rem); color: #fff; }
  .mhd-cta p { margin: 0.9rem 0 1.3rem; font-size: 1.15rem; max-width: 36rem; }

  .mhd-contact { background: var(--mist); padding: 3.2rem 0 3.5rem; }
  .mhd-contact h2 { font-size: clamp(2.1rem, 4vw, 2.8rem); color: var(--navy); text-align: center; }
  .mhd-contact .intro { text-align: center; color: var(--muted); margin: 0.45rem auto 1.2rem; max-width: 36rem; }
  .mhd-form {
    max-width: 38rem;
    margin: 0 auto;
    display: grid;
    gap: 0.8rem;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 1rem;
    padding: 1.25rem;
  }
  .mhd-form label { display: grid; gap: 0.3rem; font-weight: 700; color: var(--navy); font-size: 1.02rem; }
  .mhd-form input, .mhd-form textarea {
    width: 100%;
    border: 1.5px solid #c9d6e6;
    border-radius: 0.75rem;
    min-height: 3.1rem;
    padding: 0.65rem 0.8rem;
    font: 500 1.125rem/1.4 "DM Sans", "Segoe UI", system-ui, sans-serif;
    color: var(--ink);
    background: #fff;
  }
  .mhd-form textarea { min-height: 8rem; }
  .mhd-form .hp { position: absolute; left: -9999px; }
  .mhd-ok { background: #e7f6ee; color: #14613a; border-radius: 0.7rem; padding: 0.75rem 0.9rem; }

  .mhd-foot { background: var(--navy); color: #fff; padding: 1.6rem 0; }
  .mhd-foot-inner { display: flex; flex-wrap: wrap; gap: 0.8rem 1.5rem; align-items: center; }
  .mhd-foot nav { display: flex; flex-wrap: wrap; gap: 0.45rem 1.1rem; }
  .mhd-foot a { color: #fff; text-decoration: none; font-weight: 650; }
  .mhd-foot a:hover { text-decoration: underline; text-underline-offset: 0.18em; }
  .mhd-foot .legal { margin-left: auto; }

  @media (max-width: 980px) {
    .mhd-hero-grid, .mhd-show-grid, .mhd-how-grid, .mhd-cards, .mhd-steps, .mhd-grid { grid-template-columns: 1fr; }
    .mhd-hero h1, .mhd-show h2 { max-width: none; }
    .mhd-hero-stage { min-height: 0; margin-top: 0.4rem; }
    .mhd-hero::before { background: linear-gradient(180deg, rgba(255,255,255,.78) 0%, rgba(255,255,255,.42) 46%, rgba(255,255,255,.12) 100%); }
    .mhd-phone { position: relative; left: auto; bottom: auto; margin: -2.2rem 0 0 1rem; }
    .mhd-devices { min-height: 0; }
    .mhd-features-head { flex-direction: column; align-items: flex-start; }
    .mhd-foot .legal { margin-left: 0; }
    .mhd-screen { grid-template-columns: 120px 1fr; }
  }
  @media (max-width: 640px) {
    .mhd { font-size: 1.08rem; }
    .mhd-bar { align-items: flex-start; }
    .mhd-nav { width: 100%; margin-left: 0; }
    .mhd-hero-grid { padding: 2.2rem 0 1.6rem; }
    .mhd-hero h1 { font-size: clamp(2.55rem, 11vw, 3.3rem); letter-spacing: -0.03em; }
    .mhd-hero-actions .mhd-btn, .mhd-card button.mhd-btn { width: 100%; }
    .mhd-metrics { grid-template-columns: 1fr; }
    .mhd-screen { grid-template-columns: 1fr; }
    .mhd-side { display: flex; flex-wrap: wrap; gap: 0.2rem; }
    .mhd-side strong { width: 100%; }
  }
</style>
<div class="mhd">
  <header class="mhd-top">
    <div class="mhd-wrap mhd-bar">
      <a class="mhd-brand" href="/">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#7ec8ff" d="M6 34 24 8l18 26H6z"/>
          <path fill="#fff" d="M16 34 24 20l8 14H16z"/>
          <path fill="none" stroke="#fff" stroke-width="2" d="M8 38h32"/>
        </svg>
        MyHOADashboard.com
      </a>
      <nav aria-label="Product">
        <div class="mhd-nav">
          <a href="#why">Why us</a>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
          <a href="/demo">See the demo</a>
          <a class="mhd-btn" href="/bring-this-to-your-hoa">Bring this to your HOA</a>
        </div>
      </nav>
    </div>
  </header>

  <section class="mhd-hero">
    <div class="mhd-wrap mhd-hero-grid">
      <div class="mhd-hero-copy">
        <p class="mhd-kicker">Simple. Secure. Built for HOAs.</p>
        <h1><span>Your neighborhood.</span><span>One connected place.</span></h1>
        <p class="mhd-lead">Documents, dues, notices, and more. Everything your HOA needs in one secure portal.</p>
        <div class="mhd-hero-actions">
          <a class="mhd-btn" href="/demo">See the demo</a>
          <a class="mhd-btn ghost" href="/bring-this-to-your-hoa">Bring this to your HOA</a>
        </div>
      <form class="mhd-card" method="post" action="/neighborhood">
        <div class="mhd-card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.2 12 4.8l8 6.4"/><path d="M7 10.4V19h10v-8.6"/></svg>
        </div>
        <h2>Find your HOA</h2>
        <p class="mhd-card-copy">Enter your neighborhood code to access your community.</p>
        ${codeError}
        <label class="mhd-sr" for="neighborhood-code">Neighborhood code</label>
        <input id="neighborhood-code" name="code" inputmode="numeric" autocomplete="off" maxlength="12" required placeholder="Neighborhood code" value="${esc(code)}">
        <button class="mhd-btn" type="submit">Continue <span aria-hidden="true">→</span></button>
        <p class="mhd-lock">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/></svg>
          Secure password-free email sign-in
        </p>
      </form>
      </div>
      <div class="mhd-devices mhd-hero-stage" aria-hidden="true">
        <div class="mhd-laptop">
          <div class="mhd-screen">
            <aside class="mhd-side">
              <strong>Seaside Demo HOA</strong>
              <span class="on">Dashboard</span>
              <span>Documents</span>
              <span>News</span>
              <span>Calendar</span>
              <span>Messages</span>
              <span>Notices</span>
            </aside>
            <div class="mhd-app">
              <h3>Welcome back, Riley Coast</h3>
              <p class="who">Seaside Demo HOA, Lot 12</p>
              <div class="mhd-metrics">
                <div class="mhd-metric good"><span>Account balance</span><b>$300.00</b></div>
                <div class="mhd-metric"><span>Open invoices</span><b>1</b></div>
                <div class="mhd-metric"><span>Next meeting</span><b>Nov 12</b></div>
              </div>
              <div class="mhd-note-list">
                <div class="mhd-note"><b>Sample storm watch.</b> Stay off the sample dock until the board posts an all clear.</div>
                <div class="mhd-note"><b>Sample annual meeting.</b> Thursday, November 12, 2026, 6:00 p.m. at the clubhouse.</div>
              </div>
            </div>
          </div>
          <div class="mhd-base"></div>
        </div>
        <div class="mhd-phone">
          <div class="mhd-phone-screen">
            <strong>Riley Coast</strong>
            <p class="who">Seaside Demo HOA</p>
            <div class="mhd-metric good"><span>Balance</span><b>$300.00</b></div>
            <div class="mhd-note"><b>Notices</b><br>Sample storm watch</div>
            <div class="mhd-note"><b>Calendar</b><br>Nov 12 annual meeting</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="mhd-show">
    <div class="mhd-wrap mhd-show-grid">
      <div>
        <p class="mhd-kicker blue">A modern HOA portal</p>
        <h2>Everything your HOA needs. Nothing you don't.</h2>
        <p class="mhd-prose">Save time, stay organized, and keep owners informed with an easy to use, all in one portal for your neighborhood.</p>
      </div>
      <div class="mhd-devices" aria-hidden="true">
        <div class="mhd-laptop">
          <div class="mhd-screen">
            <aside class="mhd-side">
              <strong>Seaside Demo HOA</strong>
              <span class="on">Dashboard</span>
              <span>Documents</span>
              <span>News</span>
              <span>Calendar</span>
              <span>Messages</span>
              <span>Notices</span>
            </aside>
            <div class="mhd-app">
              <h3>Welcome back, Riley Coast</h3>
              <p class="who">Seaside Demo HOA, Lot 12</p>
              <div class="mhd-metrics">
                <div class="mhd-metric good"><span>Account balance</span><b>$300.00</b></div>
                <div class="mhd-metric"><span>Open invoices</span><b>1</b></div>
                <div class="mhd-metric"><span>Next meeting</span><b>Nov 12</b></div>
              </div>
              <div class="mhd-note-list">
                <div class="mhd-note"><b>Sample storm watch.</b> Stay off the sample dock until the board posts an all clear.</div>
                <div class="mhd-note"><b>Sample annual meeting.</b> Thursday, November 12, 2026, 6:00 p.m. at the clubhouse.</div>
                <div class="mhd-note"><b>Sample balance notice.</b> Remaining balance on the 2026 annual assessment.</div>
              </div>
            </div>
          </div>
          <div class="mhd-base"></div>
        </div>
        <div class="mhd-phone">
          <div class="mhd-phone-screen">
            <strong>Riley Coast</strong>
            <p class="who">Seaside Demo HOA</p>
            <div class="mhd-metric good"><span>Balance</span><b>$300.00</b></div>
            <div class="mhd-note"><b>Notices</b><br>Sample storm watch</div>
            <div class="mhd-note"><b>Calendar</b><br>Nov 12 annual meeting</div>
            <div class="mhd-note"><b>Documents</b><br>Covenants and forms</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section id="why" class="mhd-audiences">
    <div class="mhd-wrap mhd-cards">
      <article class="mhd-aud">
        <div class="mhd-bubble blue" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="9" cy="9" r="2.4"/><circle cx="16" cy="10" r="2"/><path d="M4.5 18.2c.6-2.3 2.2-3.4 4.5-3.4s3.9 1.1 4.5 3.4"/><path d="M13.2 14.9c.8-.3 1.7-.4 2.6-.2 1.8.3 3 1.4 3.6 3.5"/></svg></div>
        <h3>For Homeowners</h3>
        <p>View balances, pay dues, read notices, access documents, and stay informed.</p>
        <a href="#features">Learn more <span aria-hidden="true">→</span></a>
      </article>
      <article class="mhd-aud">
        <div class="mhd-bubble green" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M12 3.5 19 6.2v5.3c0 4.2-2.8 6.8-7 8.5-4.2-1.7-7-4.3-7-8.5V6.2L12 3.5z"/></svg></div>
        <h3>For Boards</h3>
        <p>Post notices, manage documents, track payments, and communicate with owners, all in one place.</p>
        <a href="#features">Learn more <span aria-hidden="true">→</span></a>
      </article>
      <article class="mhd-aud">
        <div class="mhd-bubble peach" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M4 11.2 12 4.8l8 6.4"/><path d="M7 10.4V19h10v-8.6"/></svg></div>
        <h3>For Every Neighborhood</h3>
        <p>Built for HOAs of all sizes. Simple, secure, and designed by an HOA owner.</p>
        <a href="/bring-this-to-your-hoa">Learn more <span aria-hidden="true">→</span></a>
      </article>
    </div>
  </section>

  <section id="how" class="mhd-how">
    <div class="mhd-wrap mhd-how-grid">
      <div>
        <h2>Get to your HOA in 3 simple steps.</h2>
        <p class="mhd-prose">Enter your neighborhood code, get an email link, and access your HOA portal.</p>
        <ol class="mhd-steps">
          <li class="mhd-step">
            <div class="mhd-num">01</div>
            <h3>Enter your code</h3>
            <p>Type the neighborhood code your association gave you.</p>
          </li>
          <li class="mhd-step">
            <div class="mhd-num">02</div>
            <h3>Get an email link</h3>
            <p>We send a secure, one-time link to your email. No password required.</p>
          </li>
          <li class="mhd-step">
            <div class="mhd-num">03</div>
            <h3>Access your HOA portal</h3>
            <p>Open the link to sign in and view your neighborhood's documents, notices, dues, and more.</p>
          </li>
        </ol>
      </div>
      <div class="mhd-photo">
        <p>A simpler way to a more connected neighborhood.</p>
      </div>
    </div>
  </section>

  <section id="features" class="mhd-features">
    <div class="mhd-wrap">
      <div class="mhd-features-head">
        <h2>Tools to make your HOA simpler.</h2>
        <a href="#feature-grid">See all features <span aria-hidden="true">→</span></a>
      </div>
      <div class="mhd-grid" id="feature-grid">
        <article class="mhd-feat">
          <div class="mhd-bubble green" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M7 3.5h6.2L18 8.2V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M13 3.5V8.5h5"/></svg></div>
          <h3>Documents</h3>
          <p>Covenants, bylaws, minutes, budgets, insurance, and forms. Residents see the file the board marks current.</p>
        </article>
        <article class="mhd-feat">
          <div class="mhd-bubble green" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg></div>
          <h3>Dues &amp; Payments</h3>
          <p>The board records checks and cash. Owners can pay open invoices by ACH bank transfer when the board turns online payments on. Credit and debit cards are not accepted. Bank account numbers are not stored.</p>
        </article>
        <article class="mhd-feat">
          <div class="mhd-bubble peach" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M5 9.5v5h2.2L12 18V6L7.2 9.5H5z"/><path d="M15.5 9.8a3 3 0 0 1 0 4.4"/></svg></div>
          <h3>Board Notices</h3>
          <p>The board posts notices in the portal. A notice can include a file, and the board can email owners a short link.</p>
        </article>
        <article class="mhd-feat">
          <div class="mhd-bubble lilac" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 16.5H9.2L5 19.2V8A1.5 1.5 0 0 1 6.5 6.5z"/></svg></div>
          <h3>Messages</h3>
          <p>Owners write the board in private and can attach files. The board reads and replies from the same thread.</p>
        </article>
        <article class="mhd-feat">
          <div class="mhd-bubble blue" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="4" y="5.5" width="16" height="14" rx="1.6"/><path d="M4 10h16M8 3.8v3.4M16 3.8v3.4"/></svg></div>
          <h3>Events &amp; Calendar</h3>
          <p>Announcements, meetings, and events live in the portal. The board can email owners a short link when they post one.</p>
        </article>
        <article class="mhd-feat">
          <div class="mhd-bubble rose" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/></svg></div>
          <h3>Private Records</h3>
          <p>Each association's roster, ledger, and files stay with that association. A file can be board only.</p>
        </article>
        <article class="mhd-feat">
          <div class="mhd-bubble blue" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="12" cy="8" r="3"/><path d="M6 19.2c.8-3 2.9-4.5 6-4.5s5.2 1.5 6 4.5"/></svg></div>
          <h3>Owner portal</h3>
          <p>Owners sign in with an email link. The dashboard shows balances, invoices, recorded payments, lot details, and notices for the homes they own.</p>
        </article>
        <article class="mhd-feat">
          <div class="mhd-bubble gold" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="6" y="4" width="12" height="16" rx="1.4"/><path d="M9 8h6M9 12h6M9 16h4"/></svg></div>
          <h3>Estoppel requests</h3>
          <p>A public form for estoppel certificate requests. The page links the Florida statute and emails the request to the association.</p>
        </article>
        <article class="mhd-feat">
          <div class="mhd-bubble green" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M8.4 12.2 10.9 14.6 15.6 9.6"/></svg></div>
          <h3>Electronic notice consent</h3>
          <p>Owners choose announcement email and can agree to electronic notice. Each choice is saved in a consent log with the time and the login.</p>
        </article>
      </div>
    </div>
  </section>

  <section id="faq" class="mhd-faq" aria-labelledby="faq-title">
    <div class="mhd-wrap">
      <h2 id="faq-title">FAQ</h2>
      <div class="mhd-faq-list">
        <details>
          <summary>How do owners sign in?</summary>
          <div class="ans"><p>Owners enter the email on their association account. The site sends a one-time link. Open that link to sign in. There is no password.</p></div>
        </details>
        <details>
          <summary>Do we need passwords?</summary>
          <div class="ans"><p>No. Sign in with the one-time link sent to your email. There is no password to create or reset.</p></div>
        </details>
        <details>
          <summary>Is our data private?</summary>
          <div class="ans"><p>Yes. Each association's roster, ledger, and files stay with that association. A file can be marked board only.</p></div>
        </details>
        <details>
          <summary>Can owners pay dues online?</summary>
          <div class="ans"><p>The board records checks and cash. Owners can pay open invoices by ACH bank transfer when the board turns online payments on. Credit and debit cards are not accepted. Bank account numbers are not stored.</p></div>
        </details>
        <details>
          <summary>What is a neighborhood code?</summary>
          <div class="ans"><p>It is a code of 3 to 12 digits from your association. Enter it on this page to open that neighborhood's portal.</p></div>
        </details>
        <details>
          <summary>Is there a demo?</summary>
          <div class="ans"><p>Yes. The demo is read only and uses sample data. <a href="/demo">See the demo</a> before you take the portal to your board.</p></div>
        </details>
        <details>
          <summary>How do I bring this to my HOA?</summary>
          <div class="ans"><p>Open <a href="/bring-this-to-your-hoa">Bring this to your HOA</a>. That page shows pricing, a sample dashboard, and a form to request a demo.</p></div>
        </details>
        <details>
          <summary>How does electronic notice consent work?</summary>
          <div class="ans"><p>Owners choose announcement email and can agree to electronic notice. Each choice is saved in a consent log with the time and the login.</p></div>
        </details>
        <details>
          <summary>How long does setup take?</summary>
          <div class="ans"><p>Open <a href="/bring-this-to-your-hoa">Bring this to your HOA</a> to see pricing, a sample dashboard, and what is included today. You can request a demo from that page.</p></div>
        </details>
      </div>
    </div>
  </section>

  <section class="mhd-cta" aria-labelledby="bring-title">
    <div class="mhd-wrap mhd-cta-inner">
      <p class="mhd-kicker">Ready to see it?</p>
      <h2 id="bring-title">Bring this to your HOA.</h2>
      <p>Show your board the pricing, the sample dashboard, and what is included today. You can request a demo from that page.</p>
      <a class="mhd-btn" href="/bring-this-to-your-hoa">Bring this to your HOA <span aria-hidden="true">→</span></a>
    </div>
  </section>

  <section id="contact" class="mhd-contact" aria-labelledby="contact-title">
    <div class="mhd-wrap">
      <h2 id="contact-title">Contact</h2>
      <p class="intro">Questions about your neighborhood, or about bringing this to your board? Send a message.</p>
      ${contactStatus}
      <form class="mhd-form" method="post" action="/contact">
        <label class="hp">Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
        <label>Name<input type="text" name="name" autocomplete="name" maxlength="120" required value="${esc(values.name)}"></label>
        <label>Email<input type="email" name="email" autocomplete="email" maxlength="200" required value="${esc(values.email)}"></label>
        <label>Association, optional<input type="text" name="neighborhood" maxlength="160" value="${esc(values.neighborhood)}"></label>
        <label>Message<textarea name="message" maxlength="2000" required>${esc(values.message)}</textarea></label>
        <button class="mhd-btn" type="submit">Send message</button>
      </form>
    </div>
  </section>

  <footer class="mhd-foot">
    <div class="mhd-wrap mhd-foot-inner">
      <a class="mhd-brand" href="/">
        <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#7ec8ff" d="M6 34 24 8l18 26H6z"/><path fill="#fff" d="M16 34 24 20l8 14H16z"/></svg>
        MyHOADashboard.com
      </a>
      <nav aria-label="Footer">
        <a href="#why">Why us</a>
        <a href="#how">How it works</a>
        <a href="#features">Features</a>
        <a href="#faq">FAQ</a>
        <a href="/demo">See the demo</a>
        <a href="#contact">Contact</a>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Use</a>
      </nav>
    </div>
  </footer>
</div>
`;
}
__name(productPage, "productPage");
