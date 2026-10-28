// Eingebettetes Stylesheet: keine CSS-Datei, kein Tailwind. Farben/Schrift über
// --rt-*-Variablen am Wurzelelement überschreibbar (z. B. --rt-brand).
export const TRACKING_CSS = `
.mvpf-rt,.mvpf-rt-scope{
  --rt-brand:#e20074;--rt-brand-hover:#c80067;--rt-brand-soft:#fde7f2;--rt-brand-border:#f3c1dc;--rt-brand-highlight:#fff6fa;
  --rt-bug:#b91c1c;--rt-bug-border:#f3c4c4;--rt-ink:#18181b;--rt-text-2:#52525b;--rt-muted:#71717a;--rt-faint:#a1a1aa;
  --rt-border:#e4e4e7;--rt-divider:#f0f0f2;--rt-divider-2:#ececef;--rt-disabled:#d4d4d8;
  --rt-page:#f4f4f6;--rt-column:#ebebee;--rt-track:#e9e9ec;--rt-surface:#fff;--rt-countdown:#ff4fa8;
  --rt-s-submitted-fg:#52525b;--rt-s-submitted-bg:#efeff1;--rt-s-submitted-bar:#a1a1aa;
  --rt-s-accepted-fg:oklch(0.48 0.14 255);--rt-s-accepted-bg:oklch(0.95 0.03 255);--rt-s-accepted-bar:oklch(0.6 0.14 255);
  --rt-s-in_progress-fg:oklch(0.5 0.12 60);--rt-s-in_progress-bg:oklch(0.95 0.05 80);--rt-s-in_progress-bar:oklch(0.72 0.14 70);
  --rt-s-live-fg:oklch(0.46 0.12 155);--rt-s-live-bg:oklch(0.95 0.04 155);--rt-s-live-bar:oklch(0.6 0.13 155);
  --rt-s-declined-fg:#71717a;--rt-s-declined-bg:#f4f4f5;--rt-s-declined-bar:#d4d4d8;
  --rt-font:"IBM Plex Sans",var(--font-plex-sans,ui-sans-serif),system-ui,sans-serif;
  --rt-mono:"IBM Plex Mono",var(--font-plex-mono,ui-monospace),ui-monospace,monospace;
  font-family:var(--rt-font);color:var(--rt-ink);box-sizing:border-box;-webkit-font-smoothing:antialiased;
}
.mvpf-rt{background:var(--rt-page);padding:36px 40px 40px;min-height:100%}
:where(.mvpf-rt,.mvpf-rt-scope) :where(*,*::before,*::after){box-sizing:border-box}
:where(.mvpf-rt,.mvpf-rt-scope) :where(button){font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;text-align:inherit}
:where(.mvpf-rt,.mvpf-rt-scope) :where(button:disabled){cursor:default}
:where(.mvpf-rt,.mvpf-rt-scope) :where(input,textarea,select){font:inherit;color:inherit}
:where(.mvpf-rt,.mvpf-rt-scope) :where(h1,h2,h3,h4,p){margin:0}
:where(.mvpf-rt,.mvpf-rt-scope) :focus-visible{outline:2px solid var(--rt-brand);outline-offset:2px}
.rt-inner{max-width:1180px;margin:0 auto}
.rt-mono{font-family:var(--rt-mono)}
.rt-eyebrow{font-family:var(--rt-mono);font-weight:500;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--rt-muted)}
.rt-label{font-family:var(--rt-mono);font-weight:500;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--rt-faint)}
.rt-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
.rt-tabs{display:flex;gap:32px;margin-top:6px;flex-wrap:wrap}
.rt-tab{font-size:30px;font-weight:600;line-height:1.25;padding-bottom:6px;border-bottom:3px solid transparent;color:var(--rt-faint);display:inline-flex;align-items:center;gap:10px}
.rt-tab:hover{color:var(--rt-ink)}
.rt-tab[aria-selected=true]{color:var(--rt-ink);border-bottom-color:var(--rt-brand)}
.rt-dot-new{width:8px;height:8px;border-radius:50%;background:var(--rt-brand)}
.rt-actions{display:flex;gap:10px;align-items:center;padding-bottom:12px}
.rt-seg{display:inline-flex;background:var(--rt-track);border-radius:10px;padding:3px}
.rt-seg button{font-size:14px;font-weight:500;padding:8px 12px;border-radius:8px;color:var(--rt-text-2)}
.rt-seg button[aria-pressed=true]{background:var(--rt-surface);color:var(--rt-ink);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.rt-primary{background:var(--rt-brand)!important;color:#fff!important;font-size:15px;font-weight:600;padding:11px 18px!important;border-radius:10px}
.rt-primary:hover:not(:disabled){background:var(--rt-brand-hover)!important}
.rt-primary:disabled{opacity:.45}
.rt-secondary{background:var(--rt-surface)!important;border:1px solid var(--rt-border)!important;font-size:15px;font-weight:600;padding:11px 18px!important;border-radius:10px}
.rt-bar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:24px 0 16px;flex-wrap:wrap}
.rt-scopes{display:flex;gap:4px;flex-wrap:wrap}
.rt-scope{font-size:14px;font-weight:500;padding:8px 14px;border-radius:9px;color:var(--rt-text-2)}
.rt-scope[aria-pressed=true]{background:var(--rt-ink);color:#fff}
.rt-filters{display:flex;gap:8px;flex-wrap:wrap}
.rt-filter{position:relative;font-size:13px;background:var(--rt-surface);border:1px solid var(--rt-border);border-radius:8px;padding:6px 10px;color:var(--rt-ink)}
.rt-filter select{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%}
.rt-card{background:var(--rt-surface);border:1px solid var(--rt-border);border-radius:14px}
.rt-table-row{display:grid;grid-template-columns:52px minmax(0,1fr) 170px 190px;gap:16px;padding:16px 18px;align-items:center;border-top:1px solid var(--rt-divider)}
.rt-table-row.rt-th{border-top:0;padding-top:14px;padding-bottom:12px}
.rt-row{cursor:pointer;text-align:left;width:100%}
.rt-row:hover{background:#fafafb}
.rt-table .rt-row:last-child{border-radius:0 0 14px 14px}
.rt-vote{width:44px;height:48px;border-radius:10px;border:1px solid var(--rt-border)!important;color:var(--rt-text-2)!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:14px;font-weight:600;background:var(--rt-surface)!important}
.rt-vote .rt-tri{font-size:9px;line-height:1}
.rt-vote[aria-pressed=true],.rt-chipvote[aria-pressed=true]{background:var(--rt-brand-soft)!important;border-color:var(--rt-brand-border)!important;color:var(--rt-brand)!important}
.rt-chipvote{display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:600;padding:3px 8px;border-radius:7px;border:1px solid var(--rt-border)!important;background:var(--rt-surface)!important;color:var(--rt-text-2)!important}
.rt-chipvote .rt-tri{font-size:9px}
.rt-title{font-size:16px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rt-meta{font-size:13px;color:var(--rt-muted);margin-top:4px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.rt-meta .rt-sep::before{content:"·";color:var(--rt-faint)}
.rt-type-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.rt-type-dot[data-type=bug]{background:var(--rt-bug)}
.rt-type-dot[data-type=feature]{background:var(--rt-brand)}
.rt-pill{display:inline-block;font-size:13px;font-weight:600;padding:3px 9px;border-radius:6px;white-space:nowrap}
.rt-pill-sm{font-size:12px;padding:2px 7px;border-radius:5px}
.rt-sbar{display:flex;gap:3px;margin-top:8px;width:120px}
.rt-sbar span{height:4px;flex:1;border-radius:2px;background:var(--rt-divider-2)}
.rt-ship{font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px}
.rt-ship-sub{font-size:13px;color:var(--rt-muted);margin-top:4px}
.rt-hotfix{font-family:var(--rt-mono);font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--rt-bug);border:1px solid var(--rt-bug-border);border-radius:4px;padding:1px 5px}
.rt-empty{padding:40px 18px;text-align:center;color:var(--rt-muted);font-size:14px}
[data-status=submitted]{--st-fg:var(--rt-s-submitted-fg);--st-bg:var(--rt-s-submitted-bg);--st-bar:var(--rt-s-submitted-bar)}
[data-status=accepted]{--st-fg:var(--rt-s-accepted-fg);--st-bg:var(--rt-s-accepted-bg);--st-bar:var(--rt-s-accepted-bar)}
[data-status=in_progress]{--st-fg:var(--rt-s-in_progress-fg);--st-bg:var(--rt-s-in_progress-bg);--st-bar:var(--rt-s-in_progress-bar)}
[data-status=live]{--st-fg:var(--rt-s-live-fg);--st-bg:var(--rt-s-live-bg);--st-bar:var(--rt-s-live-bar)}
[data-status=declined]{--st-fg:var(--rt-s-declined-fg);--st-bg:var(--rt-s-declined-bg);--st-bar:var(--rt-s-declined-bar)}
.rt-pill[data-status]{color:var(--st-fg);background:var(--st-bg)}
.rt-sbar[data-status] span[data-on=true]{background:var(--st-bar)}
.rt-sbar[data-status=declined] span[data-on=true]{background:var(--rt-faint)}
.rt-sbar[data-status=declined] span[data-on=true]+span[data-on=true]{background:var(--rt-disabled)}
.rt-board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;align-items:start}
.rt-board[data-cols="5"]{grid-template-columns:repeat(5,minmax(0,1fr))}
.rt-col{background:var(--rt-column);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px}
.rt-col-head{display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:600;padding:6px 8px 4px}
.rt-col-head>span{display:flex;align-items:center;gap:8px}
.rt-sdot{width:8px;height:8px;border-radius:50%;background:var(--st-bar);display:inline-block}
.rt-count{font-family:var(--rt-mono);font-size:12px;color:var(--rt-muted);font-weight:500}
.rt-bcard{background:var(--rt-surface);border-radius:10px;padding:14px;box-shadow:0 1px 2px rgba(0,0,0,.05);text-align:left;width:100%;display:block;cursor:pointer;transition:box-shadow .15s}
.rt-bcard:hover{box-shadow:0 3px 10px rgba(0,0,0,.1)}
.rt-bcard-top{display:flex;justify-content:space-between;font-size:12px;color:var(--rt-muted);gap:8px}
.rt-bcard-title{font-size:15px;font-weight:500;margin:8px 0 10px;line-height:1.35}
.rt-bcard .rt-sbar{width:100%;margin:0 0 12px}
.rt-bcard-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;font-weight:600}
.rt-bcard-foot .rt-target{color:var(--st-fg);display:flex;align-items:center;gap:6px}
.rt-hidden-note{margin-top:20px;font-size:13px;color:var(--rt-muted)}
.rt-link{color:var(--rt-brand)!important;font-weight:500}
.rt-crumb{margin-top:24px;font-size:14px;display:flex;gap:8px;align-items:center;color:var(--rt-faint)}
.rt-detail-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-top:14px;flex-wrap:wrap}
.rt-detail-title{font-size:28px;font-weight:600;margin:6px 0 0;line-height:1.25}
.rt-detail-actions{display:flex;gap:8px}
.rt-btn-outline{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;padding:9px 14px;border-radius:9px;border:1px solid var(--rt-border)!important;background:var(--rt-surface)!important}
.rt-btn-outline[aria-pressed=true].rt-upvote{background:var(--rt-brand-soft)!important;border-color:var(--rt-brand-border)!important;color:var(--rt-brand)!important}
.rt-stepper{display:grid;grid-template-columns:repeat(4,1fr);padding:24px 28px;margin-top:20px}
.rt-step{position:relative}
.rt-step-dot{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;position:relative;z-index:1;background:var(--rt-surface);border:2px solid var(--rt-disabled)}
.rt-step[data-state=done] .rt-step-dot{background:var(--rt-ink);border-color:var(--rt-ink)}
.rt-step[data-state=current] .rt-step-dot{background:var(--st-bar);border-color:var(--st-bar);box-shadow:0 0 0 5px var(--st-bg)}
.rt-step[data-state=declined] .rt-step-dot{background:var(--rt-faint);border-color:var(--rt-faint)}
.rt-step-line{position:absolute;top:10px;left:22px;right:0;height:0;border-top:3px solid var(--rt-ink)}
.rt-step[data-state=current] .rt-step-line,.rt-step[data-state=declined] .rt-step-line,.rt-step[data-state=future] .rt-step-line{border-top:2px dashed var(--rt-disabled);top:10.5px}
.rt-step-label{font-size:15px;font-weight:600;margin-top:12px}
.rt-step[data-state=future] .rt-step-label{color:var(--rt-faint)}
.rt-step[data-state=current] .rt-step-label{color:var(--st-fg)}
.rt-step-sub{font-size:13px;color:var(--rt-muted);margin-top:3px}
.rt-cols{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;margin-top:20px;align-items:start}
.rt-stack{display:flex;flex-direction:column;gap:20px}
.rt-pad{padding:22px 24px}
.rt-body{font-size:15px;line-height:1.6;margin-top:10px;white-space:pre-wrap}
.rt-q{display:flex;gap:12px;margin-top:14px}
.rt-avatar{width:32px;height:32px;border-radius:50%;background:var(--rt-ink);color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;flex:none}
.rt-q-box{flex:1;background:var(--rt-brand-highlight);border:1px solid var(--rt-brand-border);border-radius:12px;padding:14px 16px}
.rt-q-head{display:flex;justify-content:space-between;gap:8px;font-size:13px;align-items:center}
.rt-q-head b{font-weight:600}
.rt-tag{font-family:var(--rt-mono);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:4px}
.rt-tag-brand{color:var(--rt-brand);border:1px solid var(--rt-brand-border);background:var(--rt-surface)}
.rt-tag-grey{color:var(--rt-text-2);background:#f4f4f5}
.rt-q-text{font-size:15px;margin:8px 0 12px;line-height:1.5}
.rt-inline-form{display:flex;gap:8px}
.rt-input,.rt-textarea{width:100%;border:1px solid var(--rt-border);border-radius:10px;padding:10px 14px;font-size:15px;background:var(--rt-surface);outline:none}
.rt-input:focus,.rt-textarea:focus{border-color:var(--rt-brand);box-shadow:0 0 0 3px var(--rt-brand-soft)}
.rt-input[aria-invalid=true],.rt-textarea[aria-invalid=true]{border-color:var(--rt-bug)}
.rt-textarea{resize:vertical;min-height:92px;line-height:1.45}
.rt-send{background:var(--rt-brand)!important;color:#fff!important;font-weight:600;font-size:14px;padding:0 16px!important;border-radius:9px;flex:none}
.rt-send:disabled{opacity:.45}
.rt-timeline{list-style:none;margin:16px 0 18px;padding:0;display:flex;flex-direction:column;gap:16px}
.rt-timeline li{display:flex;gap:20px;font-size:14px;align-items:flex-start;line-height:1.45;padding-left:12px}
.rt-tl-dot{width:8px;height:8px;border-radius:50%;margin-top:6px;flex:none;background:var(--rt-faint)}
.rt-timeline li[data-tone=accepted] .rt-tl-dot{background:var(--rt-s-accepted-bar)}
.rt-timeline li[data-tone=in_progress] .rt-tl-dot{background:var(--rt-s-in_progress-bar)}
.rt-timeline li[data-tone=live] .rt-tl-dot{background:var(--rt-s-live-bar)}
.rt-timeline li[data-tone=comment] .rt-tl-dot{background:var(--rt-ink)}
.rt-tl-who{font-weight:600}
.rt-tl-when{color:var(--rt-muted);font-size:13px}
.rt-shipcard{background:var(--rt-ink);color:#fff;border-radius:14px;padding:22px 24px}
.rt-shipcard[data-status=live]{background:var(--rt-s-live-fg)}
.rt-shipcard[data-status=declined]{background:var(--rt-text-2)}
.rt-shipcard .rt-label{color:#a1a1aa}
.rt-shipcard[data-status=live] .rt-label,.rt-shipcard[data-status=declined] .rt-label{color:rgba(255,255,255,.7)}
.rt-ship-ver{font-size:36px;font-weight:600;margin-top:10px;display:flex;align-items:center;gap:10px;line-height:1.1}
.rt-ship-ver .rt-hotfix{background:var(--rt-bug);color:#fff;border-color:var(--rt-bug);font-size:11px}
.rt-ship-date{font-size:15px;color:#d4d4d8;margin-top:6px}
.rt-cd{margin-top:22px;display:flex;align-items:baseline;gap:8px;font-size:14px;color:#e4e4e7}
.rt-cd b{font-size:28px;font-weight:600;color:var(--rt-countdown)}
.rt-progress{height:4px;background:#3f3f46;border-radius:2px;margin-top:8px;overflow:hidden}
.rt-progress span{display:block;height:100%;background:var(--rt-brand)}
.rt-note{font-size:12px;color:#a1a1aa;margin-top:10px}
.rt-kv{display:flex;justify-content:space-between;font-size:14px;padding:7px 0;color:var(--rt-text-2);gap:10px}
.rt-kv b{color:var(--rt-ink);font-weight:600}
.rt-linked{display:flex;gap:10px;align-items:center;font-size:14px;margin-top:12px}
.rt-add-link{font-size:13px;font-weight:600;color:var(--rt-brand)!important;margin-top:12px;display:inline-block}
.rt-legend{display:flex;gap:18px;margin-top:24px;font-size:13px;color:var(--rt-text-2);flex-wrap:wrap}
.rt-legend span{display:inline-flex;align-items:center;gap:6px}
.rt-sq{width:12px;height:12px;border-radius:3px;background:var(--rt-ink);display:inline-block}
.rt-dia{width:10px;height:10px;background:var(--rt-bug);transform:rotate(45deg);display:inline-block}
.rt-circ{width:10px;height:10px;border-radius:50%;background:var(--rt-brand);display:inline-block}
.rt-tlcard{margin-top:16px;padding:20px 28px 20px;overflow-x:auto}
.rt-tl-grid{position:relative;min-width:720px}
.rt-tl-months{position:relative;height:28px;margin-left:110px;border-bottom:1px solid var(--rt-divider)}
.rt-tl-months span{position:absolute;top:4px;font-family:var(--rt-mono);font-size:11px;letter-spacing:.08em;color:var(--rt-faint);text-transform:uppercase;padding-left:12px}
.rt-lane{display:flex;align-items:stretch;border-bottom:1px solid var(--rt-divider)}
.rt-lane:last-child{border-bottom:0}
.rt-lane-label{width:110px;flex:none;display:flex;flex-direction:column;justify-content:center;font-size:14px;font-weight:600}
.rt-lane-label small{font-size:12px;color:var(--rt-muted);font-weight:400;margin-top:2px}
.rt-lane-track{position:relative;flex:1}
.rt-tl-item{position:absolute;top:50%;display:flex;align-items:center;gap:10px;transform:translate(-14px,-50%);white-space:nowrap}
.rt-tl-item[data-past=true]{opacity:.5}
.rt-tl-item[data-kind=hotfix]{transform:translate(-7px,-50%)}
.rt-tl-shape{position:relative;flex:none}
.rt-tl-item[data-kind=release] .rt-tl-shape{width:28px;height:28px;border-radius:7px;background:var(--rt-ink)}
.rt-tl-item[data-kind=release][data-state=planning] .rt-tl-shape{background:var(--rt-surface);border:2px solid var(--rt-ink)}
.rt-tl-item[data-kind=release][data-past=true] .rt-tl-shape{background:#c4c4c8}
.rt-tl-item[data-kind=hotfix] .rt-tl-shape{width:14px;height:14px;transform:rotate(45deg);background:var(--rt-bug)}
.rt-tl-item[data-kind=hotfix][data-conditional=true] .rt-tl-shape{background:var(--rt-surface);border:2px solid var(--rt-bug)}
.rt-tl-item[data-kind=hotfix][data-past=true] .rt-tl-shape{background:#c4c4c8}
.rt-tl-mine{position:absolute;top:-5px;right:-5px;width:12px;height:12px;border-radius:50%;background:var(--rt-brand);border:2px solid var(--rt-surface)}
.rt-tl-item[data-kind=hotfix] .rt-tl-mine{transform:rotate(-45deg)}
.rt-tl-name{font-size:14px;font-weight:600}
.rt-tl-sub{font-size:12px;color:var(--rt-muted)}
.rt-today{position:absolute;top:0;bottom:0;width:2px;background:var(--rt-brand);z-index:2;pointer-events:none}
.rt-today span{position:absolute;top:4px;left:50%;transform:translateX(-50%);font-family:var(--rt-mono);font-size:10px;font-weight:600;letter-spacing:.08em;color:var(--rt-brand);text-transform:uppercase;background:var(--rt-surface);padding:0 4px}
.rt-rcards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:20px}
.rt-rcard{padding:20px 22px}
.rt-rcard[data-state=planning]{border-style:dashed;border-color:#d4d4d8}
.rt-rcard-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.rt-rcard-title{font-size:18px;font-weight:600;display:flex;align-items:center;gap:8px}
.rt-rcard-title .rt-sq{width:11px;height:11px}
.rt-rcard[data-state=planning] .rt-rcard-title .rt-sq{background:var(--rt-surface);border:2px solid var(--rt-ink)}
.rt-chip-when{font-family:var(--rt-mono);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:5px;background:#f4f4f5;color:var(--rt-text-2);white-space:nowrap}
.rt-chip-when[data-soon=true]{background:var(--rt-brand-soft);color:var(--rt-brand)}
.rt-rcard-sub{font-size:13px;color:var(--rt-muted);margin-top:4px}
.rt-rcard ul{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-direction:column;gap:10px;font-size:14px}
.rt-rcard li{display:flex;gap:10px;align-items:baseline}
.rt-rcard li::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--rt-disabled);flex:none;transform:translateY(-2px)}
.rt-rcard li button{display:inline;text-align:left}
.rt-rcard li[data-mine=true]{font-weight:500}
.rt-rcard li[data-mine=true]::before{background:var(--rt-brand)}
.rt-rcard li .rt-yours{color:var(--rt-brand);font-size:12px;font-weight:400;white-space:nowrap}
.rt-more{color:var(--rt-muted);font-size:13px}
.rt-wn{display:grid;grid-template-columns:160px minmax(0,1fr);gap:28px;margin-top:24px;align-items:start}
.rt-wn-nav{display:flex;flex-direction:column;gap:2px;position:sticky;top:16px}
.rt-wn-nav button{text-align:left;font-size:14px;padding:9px 12px;border-radius:8px;color:var(--rt-text-2)}
.rt-wn-nav button[aria-current=true]{background:var(--rt-surface);color:var(--rt-ink);font-weight:600}
.rt-wn-card{padding:24px 26px;scroll-margin-top:16px}
.rt-wn-head{display:flex;align-items:center;gap:10px}
.rt-wn-head h3{font-size:20px;font-weight:600;margin:0}
.rt-wn-head span{font-size:14px;color:var(--rt-muted)}
.rt-wn-mine{margin-top:18px;background:var(--rt-brand-highlight);border:1px solid var(--rt-brand-border);border-radius:12px;padding:16px 18px;display:flex;justify-content:space-between;gap:12px}
.rt-wn-mine .rt-label{color:var(--rt-brand)}
.rt-wn-mine h4,.rt-wn-item h4{font-size:16px;font-weight:600;margin:8px 0 4px}
.rt-wn-mine p,.rt-wn-item p{font-size:14px;color:var(--rt-text-2);margin:0;line-height:1.45}
.rt-wn-list{list-style:none;margin:16px 0 0;padding:0;font-size:14px;color:var(--rt-text-2);display:flex;flex-direction:column;gap:8px}
.rt-wn-list li::before{content:"· "}
.rt-wn-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px}
.rt-wn-item{border:1px solid var(--rt-border);border-radius:12px;padding:16px}
.rt-wn-item .rt-tag{display:inline-block}
.rt-overlay{position:fixed;inset:0;background:rgba(24,24,27,.45);z-index:1000;overflow-y:auto;padding:60px 16px 40px;font-family:var(--rt-font);color:var(--rt-ink)}
.rt-dialog{max-width:580px;margin:0 auto;background:var(--rt-surface);border-radius:20px;box-shadow:0 20px 50px rgba(0,0,0,.25);overflow:hidden}
.rt-dialog-body{padding:28px 28px 22px}
.rt-type-seg{display:grid;grid-template-columns:1fr 1fr;background:#f4f4f5;border-radius:12px;padding:4px}
.rt-type-seg button,.rt-primary,.rt-secondary,.rt-seg button,.rt-chip,.rt-send{text-align:center}
.rt-type-seg button{font-size:15px;font-weight:600;padding:11px;border-radius:9px;color:var(--rt-text-2)}
.rt-type-seg button[aria-pressed=true]{background:var(--rt-surface);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.rt-type-seg button[aria-pressed=true][data-type=bug]{color:var(--rt-bug)}
.rt-type-seg button[aria-pressed=true][data-type=feature]{color:var(--rt-brand)}
.rt-dialog h2{font-size:22px;font-weight:600;margin:22px 0 10px}
.rt-ctx{display:flex;gap:6px;flex-wrap:wrap}
.rt-ctx span{background:#f4f4f5;border-radius:6px;padding:4px 8px;font-size:12px;color:var(--rt-ink);display:inline-flex;gap:6px;align-items:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rt-ctx span i{font-style:normal;font-family:var(--rt-mono);font-size:10px;letter-spacing:.06em;color:var(--rt-muted);text-transform:uppercase}
.rt-ctx-note{font-size:12px;color:var(--rt-faint);margin-top:6px}
.rt-field{margin-top:20px}
.rt-field>label,.rt-flabel{display:block;font-size:14px;font-weight:600;margin-bottom:8px}
.rt-field-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.rt-err{font-size:12px;color:var(--rt-bug);margin-top:6px}
.rt-similar{margin-top:10px;background:#fafafa;border:1px solid var(--rt-border);border-radius:10px;padding:12px 14px}
.rt-similar-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:8px}
.rt-similar-row b{font-size:14px;font-weight:500;display:block;cursor:pointer}
.rt-similar-row small{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--rt-muted);margin-top:3px}
.rt-chips{display:flex;gap:8px;flex-wrap:wrap}
.rt-chip{font-size:14px;font-weight:500;padding:8px 13px;border-radius:8px;border:1px solid var(--rt-border)!important;background:var(--rt-surface)!important}
.rt-chip[aria-pressed=true]{background:var(--rt-ink)!important;color:#fff!important;border-color:var(--rt-ink)!important}
.rt-hint{font-size:12px;color:var(--rt-muted);margin-top:8px}
.rt-toggle{display:flex;gap:12px;align-items:flex-start;margin-top:18px;text-align:left}
.rt-switch{width:38px;height:22px;border-radius:11px;background:var(--rt-disabled);position:relative;flex:none;transition:background .15s}
.rt-switch::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}
.rt-toggle[aria-checked=true] .rt-switch{background:var(--rt-brand)}
.rt-toggle[aria-checked=true] .rt-switch::after{left:19px}
.rt-toggle b{display:block;font-size:14px;font-weight:600}
.rt-toggle small{font-size:12px;color:var(--rt-muted)}
.rt-drop{border:1.5px dashed var(--rt-disabled);border-radius:12px;padding:18px;display:flex;flex-direction:column;align-items:center;gap:8px;font-size:12px;color:var(--rt-muted);text-align:center}
.rt-drop[data-over=true]{border-color:var(--rt-brand);background:var(--rt-brand-highlight)}
.rt-file{border:1px solid var(--rt-border);border-radius:12px;padding:10px;display:flex;gap:12px;align-items:center;margin-top:8px}
.rt-thumb{width:64px;height:44px;border-radius:6px;flex:none;background:repeating-linear-gradient(135deg,#ececef 0 6px,#f6f6f7 6px 12px);background-size:cover;background-position:center}
.rt-file b{font-size:14px;font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rt-file small{font-size:12px;color:var(--rt-muted)}
.rt-file button{margin-left:auto;font-size:13px;color:var(--rt-muted)}
.rt-dialog-foot{border-top:1px solid var(--rt-divider);padding:18px 28px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.rt-check{display:flex;gap:10px;align-items:center;font-size:14px;cursor:pointer}
.rt-check input{width:18px;height:18px;accent-color:var(--rt-brand);margin:0}
.rt-dialog[data-type=bug] .rt-check input{accent-color:var(--rt-bug)}
.rt-foot-btns{display:flex;gap:10px}
.rt-dialog[data-type=bug] .rt-primary{background:var(--rt-bug)!important}
.rt-success{padding:32px 32px 30px}
.rt-success-icon{width:48px;height:48px;border-radius:50%;background:var(--rt-s-live-bg);color:var(--rt-s-live-fg);display:flex;align-items:center;justify-content:center;font-size:22px}
.rt-success h2{margin:18px 0 6px;font-size:22px}
.rt-success p{font-size:15px;color:var(--rt-text-2);margin:0;line-height:1.5}
.rt-success-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:22px}
.rt-success-steps div{border-top:4px solid var(--rt-divider-2);padding-top:8px;font-size:12px;color:var(--rt-faint)}
.rt-success-steps div:first-child{border-color:var(--rt-ink);color:var(--rt-ink);font-weight:600}
.rt-success .rt-foot-btns{justify-content:flex-end;margin-top:28px}
.rt-toast{background:#18181b;color:#fff;border-radius:14px;padding:16px 18px;display:flex;gap:14px;align-items:flex-start;max-width:420px;box-shadow:0 10px 30px rgba(0,0,0,.2);font-family:var(--rt-font)}
.rt-toast-icon{width:36px;height:36px;border-radius:50%;background:var(--rt-s-live-bar,oklch(0.6 0.13 155));display:flex;align-items:center;justify-content:center;flex:none;font-weight:600}
.rt-toast b{font-size:15px;font-weight:600;display:block}
.rt-toast p{font-size:14px;color:#d4d4d8;margin:3px 0 0;line-height:1.45}
.rt-toast-actions{display:flex;gap:14px;margin-top:10px;font-size:13px;font-weight:600}
.rt-toast-actions button:first-child{color:var(--rt-countdown,#ff4fa8)}
.rt-toast-actions button:last-child{color:#a1a1aa}
.rt-bell{position:relative;display:inline-block;font-family:var(--rt-font)}
.rt-bell-btn{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;position:relative;color:var(--rt-ink)}
.rt-bell-btn:hover{background:var(--rt-track)}
.rt-bell-badge{position:absolute;top:6px;right:6px;min-width:16px;height:16px;border-radius:8px;background:var(--rt-brand);color:#fff;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 4px}
.rt-bell-panel{position:absolute;right:0;top:46px;width:420px;max-width:calc(100vw - 32px);background:var(--rt-surface);border:1px solid var(--rt-border);border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.14);z-index:1000;overflow:hidden;color:var(--rt-ink)}
.rt-bell-head{padding:16px 18px;border-bottom:1px solid var(--rt-divider-2);display:flex;justify-content:space-between;align-items:center}
.rt-bell-head b{font-size:16px;font-weight:600}
.rt-bell-head button{font-size:13px;color:var(--rt-muted)}
.rt-bell-list{max-height:420px;overflow-y:auto}
.rt-nrow{padding:14px 18px;display:flex;gap:12px;border-bottom:1px solid var(--rt-divider);text-align:left;width:100%}
.rt-nrow:last-child{border-bottom:0}
.rt-nrow[data-unread=true]{background:var(--rt-brand-highlight)}
.rt-ndot{width:8px;height:8px;border-radius:50%;margin-top:7px;flex:none}
.rt-nrow[data-unread=true] .rt-ndot{background:var(--rt-brand)}
.rt-ntext{font-size:14px;line-height:1.45;color:var(--rt-text-2)}
.rt-nrow[data-unread=true] .rt-ntext{color:var(--rt-ink)}
.rt-ntext b{font-weight:600;color:var(--rt-ink)}
.rt-nwhen{font-size:12px;color:var(--rt-muted);margin-top:3px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.rt-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
@media (max-width:900px){
  .mvpf-rt{padding:24px 16px 32px}
  .rt-tab{font-size:22px}
  .rt-tabs{gap:20px}
  .rt-table-row{grid-template-columns:44px minmax(0,1fr);row-gap:10px}
  .rt-table-row.rt-th{display:none}
  .rt-table-row>:nth-child(3),.rt-table-row>:nth-child(4){grid-column:2}
  .rt-vote{width:40px;height:44px}
  .rt-title{white-space:normal}
  .rt-board,.rt-board[data-cols="5"]{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:minmax(240px,1fr);overflow-x:auto;padding-bottom:6px}
  .rt-cols{grid-template-columns:minmax(0,1fr)}
  .rt-stepper{padding:18px 16px}
  .rt-step-label{font-size:13px}
  .rt-step-sub{font-size:12px}
  .rt-rcards,.rt-wn-grid{grid-template-columns:minmax(0,1fr)}
  .rt-wn{grid-template-columns:minmax(0,1fr)}
  .rt-wn-nav{flex-direction:row;overflow-x:auto;position:static}
  .rt-wn-nav button{white-space:nowrap}
  .rt-field-2{grid-template-columns:minmax(0,1fr)}
  .rt-detail-title{font-size:22px}
  .rt-dialog-body{padding:22px 18px 18px}
  .rt-dialog-foot{padding:16px 18px}
  .rt-overlay{padding-top:16px}
}
`;
