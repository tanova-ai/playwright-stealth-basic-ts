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

  const { url, waitForSelector, usePrintMedia } = req.body;

  console.log('📄 PDF Generation Request:', { url, waitForSelector, usePrintMedia });

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

    // Navigate to URL first
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Optional: wait for specific selector to ensure content is loaded
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 10000 });
    }

    // If usePrintMedia is true, inject a style tag to simulate print media
    // This is more reliable than emulateMedia for PDF generation
    if (usePrintMedia) {
      console.log('🖨️  Applying print media styles...');

      // Emulate print media
      await page.emulateMedia({ media: 'print' });

      // Also inject CSS to force all @media print styles to apply
      await page.addStyleTag({
        content: `
          /* Force all print:hidden elements to be hidden */
          .print\\:hidden { display: none !important; }

          /* Force all print:flex elements to be flex */
          .print\\:flex { display: flex !important; }

          /* Force all print:block elements to be block */
          .print\\:block { display: block !important; }

          /* Apply any other print-specific styles */
        `
      });

      // Wait for styles to apply
      await page.waitForTimeout(500);

      console.log('✅ Print styles applied');
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
