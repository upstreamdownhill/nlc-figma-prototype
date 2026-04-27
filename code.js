// Plugin main — runs in Figma's sandbox (no DOM access here)

figma.showUI(__html__, { width: 440, height: 740 });

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function getNextVersion(campaignName) {
  const escaped = campaignName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^' + escaped + ' v(\\d+)$');
  let max = 0;
  for (const page of figma.root.children) {
    const m = page.name.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

function progress(text) {
  figma.ui.postMessage({ type: 'progress', text });
}

// Creates a transparent, non-clipping child frame — used as a named layer group
function makeLayer(parent, name, x, y, w, h) {
  const f = figma.createFrame();
  f.name = name;
  f.x = x;
  f.y = y;
  f.resize(w, h);
  f.fills = [];
  f.clipsContent = false;
  parent.appendChild(f);
  return f;
}

// Tries to load requested font style; falls back through variants then to Inter
async function loadFont(family, style) {
  const fallbackStyles = style === 'Bold'
    ? ['Bold', 'SemiBold', 'Semi Bold', '700', 'Regular']
    : ['Regular', 'Normal', '400'];

  for (const s of fallbackStyles) {
    try {
      await figma.loadFontAsync({ family, style: s });
      return { family, style: s };
    } catch (_) { /* try next */ }
  }

  // Family not available — fall back to Inter
  await figma.loadFontAsync({ family: 'Inter', style });
  return { family: 'Inter', style };
}

// ── Core function ─────────────────────────────────────────────────────────────

async function createInstagramAd(data) {
  const {
    campaignName, brandName,
    primaryColor, secondaryColor,
    fontFamily,
    headline, bodyText, ctaText,
    backgroundData, logoData,
  } = data;

  const W = 1080;
  const H = 1080;
  const SAFE = 60; // safe-zone margin in px (~5.5%)

  // ── Page + version ──
  progress('Creating page…');
  const version = getNextVersion(campaignName);
  const page = figma.createPage();
  page.name = `${campaignName} v${version}`;
  figma.currentPage = page;

  // ── Artboard ──
  const ad = figma.createFrame();
  ad.name = campaignName;
  ad.resize(W, H);
  ad.x = 0;
  ad.y = 0;
  ad.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

  // ── Safe-zone guides (page-level, absolute coordinates) ──
  page.guides = [
    { axis: 'X', offset: SAFE },
    { axis: 'X', offset: W - SAFE },
    { axis: 'Y', offset: SAFE },
    { axis: 'Y', offset: H - SAFE },
  ];

  // ── Brand color styles ──
  progress('Creating color styles…');
  const primaryRgb   = hexToRgb(primaryColor   || '#000000');
  const secondaryRgb = hexToRgb(secondaryColor || '#666666');

  const ps = figma.createPaintStyle();
  ps.name = `${brandName}/Primary`;
  ps.paints = [{ type: 'SOLID', color: primaryRgb }];

  const ss = figma.createPaintStyle();
  ss.name = `${brandName}/Secondary`;
  ss.paints = [{ type: 'SOLID', color: secondaryRgb }];

  // ── Named layers (bottom → top render order) ──
  const bgLayer     = makeLayer(ad, 'Background', 0,    0,            W,            H           );
  const assetsLayer = makeLayer(ad, 'Assets',     SAFE, SAFE,         W - SAFE * 2, H - SAFE * 2);
  const textLayer   = makeLayer(ad, 'Text',       SAFE, SAFE,         W - SAFE * 2, H - SAFE * 2);
  const ctaLayer    = makeLayer(ad, 'CTA',        SAFE, H - SAFE - 100, W - SAFE * 2, 100       );

  // ── Background image ──
  if (backgroundData && backgroundData.length) {
    progress('Importing background…');
    const img = figma.createImage(new Uint8Array(backgroundData));
    const rect = figma.createRectangle();
    rect.name = 'Background Image';
    rect.resize(W, H);
    rect.x = 0;
    rect.y = 0;
    rect.fills = [{ type: 'IMAGE', imageHash: img.hash, scaleMode: 'FILL' }];
    bgLayer.appendChild(rect);
  }

  // ── Fonts ──
  progress('Loading fonts…');
  const regular = await loadFont(fontFamily, 'Regular');
  const bold    = await loadFont(fontFamily, 'Bold');

  // ── Headline ──
  if (headline) {
    const t = figma.createText();
    t.name = 'Headline';
    t.fontName = bold;
    t.fontSize = 80;
    t.characters = headline;
    t.fills = [{ type: 'SOLID', color: primaryRgb }];
    t.textAutoResize = 'HEIGHT';
    t.resize(W - SAFE * 2, 80);
    t.x = 0;
    t.y = 200;
    textLayer.appendChild(t);
  }

  // ── Body text ──
  if (bodyText) {
    const t = figma.createText();
    t.name = 'Body';
    t.fontName = regular;
    t.fontSize = 40;
    t.lineHeight = { value: 130, unit: 'PERCENT' };
    t.characters = bodyText;
    t.fills = [{ type: 'SOLID', color: { r: 0.15, g: 0.15, b: 0.15 } }];
    t.textAutoResize = 'HEIGHT';
    t.resize(W - SAFE * 2, 80);
    t.x = 0;
    t.y = 460;
    textLayer.appendChild(t);
  }

  // ── CTA button + label ──
  if (ctaText) {
    const btnW  = Math.min(360, W - SAFE * 2);
    const btnH  = 80;

    const btn = figma.createRectangle();
    btn.name = 'Button';
    btn.resize(btnW, btnH);
    btn.x = 0;
    btn.y = 10;
    btn.cornerRadius = 8;
    btn.fills = [{ type: 'SOLID', color: primaryRgb }];
    ctaLayer.appendChild(btn);

    const label = figma.createText();
    label.name = 'Button Label';
    label.fontName = bold;
    label.fontSize = 36;
    label.characters = ctaText;
    label.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    label.textAlignHorizontal = 'CENTER';
    label.textAlignVertical = 'CENTER';
    label.textAutoResize = 'NONE';
    label.resize(btnW, btnH);
    label.x = 0;
    label.y = 10;
    ctaLayer.appendChild(label);
  }

  // ── Logo ──
  if (logoData && logoData.length) {
    progress('Importing logo…');
    const img = figma.createImage(new Uint8Array(logoData));
    const rect = figma.createRectangle();
    rect.name = 'Logo';
    rect.resize(240, 80);
    rect.x = 0;
    rect.y = 0;
    rect.fills = [{ type: 'IMAGE', imageHash: img.hash, scaleMode: 'FIT' }];
    assetsLayer.appendChild(rect);
  }

  // ── Finish ──
  figma.viewport.scrollAndZoomIntoView([ad]);
  figma.currentPage.selection = [ad];
}

// ── Message handler ───────────────────────────────────────────────────────────

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'create-ad') {
    try {
      await createInstagramAd(msg.data);
      figma.ui.postMessage({ type: 'success' });
    } catch (err) {
      figma.ui.postMessage({ type: 'error', text: String(err) });
    }
  } else if (msg.type === 'close') {
    figma.closePlugin();
  }
};
