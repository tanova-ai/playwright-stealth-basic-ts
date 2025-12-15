/**
 * Playwright PDF Generation Service for Tanova
 * Replace the contents of main.ts in your Railway Playwright repo with this code
 */

import express from 'express';
import { chromium } from 'playwright';

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.PLAYWRIGHT_SERVICE_SECRET;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'playwright-pdf-generator' });
});

// PDF generation endpoint
app.post('/generate-pdf', async (req, res) => {
  // Authentication check
  const authHeader = req.headers.authorization;

  // Skip auth for internal Railway network
  const isInternalRequest = req.headers['x-forwarded-for'] === undefined;

  if (!isInternalRequest && authHeader !== `Bearer ${SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { url, waitForSelector } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  let browser;
  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Navigate to URL
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Optional: wait for specific selector to ensure content is loaded
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 10000 });
    }

    // Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();

    // Return PDF as buffer
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.send(pdf);

  } catch (error: any) {
    console.error('PDF generation failed:', error);

    if (browser) {
      await browser.close().catch(console.error);
    }

    res.status(500).json({
      error: 'Failed to generate PDF',
      message: error?.message || 'Unknown error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Playwright PDF service running on port ${PORT}`);
  console.log(`   Auth: ${SECRET ? 'Enabled' : 'Disabled (set PLAYWRIGHT_SERVICE_SECRET)'}`);
});
