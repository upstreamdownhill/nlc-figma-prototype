const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const path    = require('path');

const app    = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store — one brief at a time (prototype)
let pendingBrief = null;

// Submit a brief from the browser form
app.post('/api/brief', upload.fields([
  { name: 'backgroundFile', maxCount: 1 },
  { name: 'logoFile',       maxCount: 1 },
]), (req, res) => {
  const {
    campaignName, brandName,
    primaryColor, secondaryColor,
    fontFamily,
    headline, bodyText, ctaText,
  } = req.body;

  pendingBrief = {
    campaignName,
    brandName,
    primaryColor:   primaryColor   || '#000000',
    secondaryColor: secondaryColor || '#666666',
    fontFamily:     fontFamily     || 'Inter',
    headline:       headline       || '',
    bodyText:       bodyText       || '',
    ctaText:        ctaText        || '',
    backgroundData: req.files?.backgroundFile?.[0]?.buffer
      ? Array.from(req.files.backgroundFile[0].buffer) : null,
    logoData: req.files?.logoFile?.[0]?.buffer
      ? Array.from(req.files.logoFile[0].buffer) : null,
    submittedAt: new Date().toISOString(),
  };

  res.json({ success: true });
});

// Figma plugin polls this to pick up the latest brief
app.get('/api/brief', (_req, res) => {
  if (!pendingBrief) return res.json({ available: false });
  res.json({ available: true, brief: pendingBrief });
});

// Plugin marks the brief as consumed
app.delete('/api/brief', (_req, res) => {
  pendingBrief = null;
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`NLC Brief Server → http://localhost:${PORT}`)
);
