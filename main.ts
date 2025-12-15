/**
 * Playwright PDF Generation Service for Tanova
 * Replace the contents of main.ts in your Railway Playwright repo with this code
 *
 * Note: Print mode is now handled via ?print=true query parameter in the URL,
 * so we don't need to emulate print media or inject CSS
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

  console.log('📄 PDF Generation Request:', { url, waitForSelector });

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

    // Navigate to URL (URL should contain ?print=true for print-optimized layout)
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
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      preferCSSPageSize: false
    });

    await browser.close();

    console.log(`✅ PDF generated (${pdf.length} bytes)`);

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
