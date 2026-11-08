import { icon } from '../ui.js';

const engines=[
  ['message','Communication threat intelligence','Checks texts and website addresses for impersonation, risky requests, and deceptive links.'],
  ['spark','Conversation manipulation intelligence','Notices observable pressure tactics, such as urgency, secrecy, and isolation, as a conversation unfolds.'],
  ['clock','Predictive risk intelligence','Estimates the harmful request that may come next, shows the evidence, and states its uncertainty.'],
  ['shield','Adaptive intervention','Low, elevated, and high warnings, proportional to the evidence, so you are not interrupted for nothing.'],
  ['book','Scam network intelligence','Connects shared numbers, links, and scripts. Shown here with a synthetic demo dataset.'],
];
const stages=[
  ['Before','Prevention','Check a suspicious text or link, set up trusted contacts, and agree on how you will verify family.'],
  ['During','Real-time protection','Watch a call unfold with a live manipulation timeline, risk level, and a warning before the risky step.'],
  ['After','Recovery','If you already acted, get clear next steps for your bank, your accounts, and reporting. No judgment.'],
];

export function landing(configured) {
  return `<div class="landing" id="main" tabindex="-1">
    <header class="landing-top"><a class="brand" href="#/welcome"><span class="brand-mark">${icon('shield')}</span>T-Secure<span class="brand-period">.</span></a>
      <nav class="landing-actions" aria-label="Account"><a class="button secondary" href="#/login">Sign in</a><a class="button primary" href="#/signup">Create account</a></nav></header>
    <main>
    <section class="landing-hero" aria-labelledby="hero-title">
      <div class="hero-copy"><span class="eyebrow">AI-powered communication protection · Prototype</span>
        <h1 id="hero-title">Protecting the people behind every conversation.</h1>
        <p class="hero-lede">T-Secure watches how a conversation develops, not just who is calling. It spots manipulation as it builds, predicts the risky request before it arrives, and gives you a calm, clear next step.</p>
        <div class="button-row"><a class="button primary" href="#/signup">Get started ${icon('arrow')}</a><button class="button secondary" data-action="enter-demo">${icon('play')}Explore the demo</button></div>
        ${configured?'':'<p class="quiet-note">Accounts are not connected in this build. The demo runs fully in your browser.</p>'}
      </div>
      <figure class="hero-timeline" aria-label="Example: how T-Secure follows a family-emergency scam call">
        <ol>
          <li><span>0:05</span><strong>Possible family impersonation</strong><q>Hey, it's me. I'm in serious trouble.</q></li>
          <li><span>0:12</span><strong>Fear</strong><q>I got arrested, and I need your help.</q></li>
          <li><span>0:20</span><strong>Urgency · Financial pressure</strong><q>I need money immediately.</q></li>
          <li><span>0:29</span><strong>Secrecy</strong><q>Please don't tell anyone.</q></li>
          <li class="hero-warning"><span>0:30</span><strong>${icon('alert')}Warning: a money request may come next</strong><em>Hang up and call your grandson on a number you already have.</em></li>
        </ol>
        <figcaption>Scenario A from the demo. Synthetic conversation.</figcaption>
      </figure>
    </section>
    <section class="landing-section" aria-labelledby="problem-title"><h2 id="problem-title">Scams don’t arrive as one suspicious word.</h2>
      <p class="section-lede">AI voices, cloned identities, and practiced scripts make a scam sound real. They build trust first, then fear, then urgency, then secrecy, and only then ask for money. Number blocking and keyword filters miss that progression. T-Secure is built to follow it.</p></section>
    <section class="landing-section" aria-labelledby="stages-title"><h2 id="stages-title">Three levels of protection</h2>
      <div class="stage-grid">${stages.map(([when,title,copy])=>`<article class="stage-card"><span class="eyebrow">${when}</span><h3>${title}</h3><p>${copy}</p></article>`).join('')}</div></section>
    <section class="landing-section" aria-labelledby="how-title"><h2 id="how-title">How protection works</h2>
      <ol class="how-steps"><li><strong>Quick checks first.</strong> Independent rules look for risky requests and deceptive links.</li><li><strong>Context from AI.</strong> When connected, NVIDIA Nemotron or Google Gemini reads the whole conversation. Every quote it returns must appear in the text.</li><li><strong>Proportional warnings.</strong> The risk engine combines both. AI can raise a rating by one level at most, and can never lower one.</li><li><strong>You decide.</strong> T-Secure explains its evidence and suggests a safer step. It never ends a call or contacts anyone for you.</li></ol>
      <div class="engine-grid">${engines.map(([glyph,title,copy])=>`<article class="engine-card">${icon(glyph)}<h3>${title}</h3><p>${copy}</p></article>`).join('')}</div></section>
    <section class="landing-section split" aria-labelledby="families-title"><div><h2 id="families-title">Designed with older adults in mind</h2><ul class="check-list"><li>${icon('check')}Large text, high contrast, and simple language</li><li>${icon('check')}Warnings that explain why, not just a red screen</li><li>${icon('check')}Verify family your way: a saved number, a family passphrase, or a callback</li><li>${icon('check')}Optional trusted contacts you can call with one tap</li></ul></div>
      <div><h2>A familiar voice is not proof.</h2><p>Voices can be cloned, so T-Secure never tells you a caller is genuine because they sound right. It also doesn’t treat a synthetic voice as proof of a scam. Synthetic-voice detection is planned only as a supporting signal. The conversation and independent verification come first.</p></div></section>
    <section class="landing-section privacy-band" aria-labelledby="privacy-title">${icon('lock')}<div><h2 id="privacy-title">Our privacy commitment</h2><p>We don’t save raw messages or transcripts, only the risk level, the warning categories, and what you chose to do. We never score how “vulnerable” you are. Trusted contacts are never contacted automatically. You can delete your history at any time.</p></div></section>
    <section class="landing-section" aria-labelledby="tmobile-title"><h2 id="tmobile-title">Why a carrier should care</h2>
      <p class="section-lede">Protection that customers can see and understand builds trust and loyalty, and sets a carrier apart. T-Secure is designed so that T-Life and network-level scam protection could plug in later without a rebuild. Those are future opportunities: this prototype is not affiliated with, approved by, or integrated with T-Mobile.</p></section>
    <section class="landing-cta"><h2>Take a closer look, together.</h2><div class="button-row"><a class="button primary" href="#/signup">Create your account ${icon('arrow')}</a><button class="button secondary" data-action="enter-demo">Explore the demo</button><a class="text-link" href="#/login">I already have an account</a></div></section>
    </main>
    <footer class="landing-footer">${icon('info')}A hackathon prototype. Calls are simulated with scripted conversations. No carrier integration, call monitoring, or real T-Mobile services are used.</footer>
  </div>`;
}
