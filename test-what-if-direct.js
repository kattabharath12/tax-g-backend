
const puppeteer = require('puppeteer');

async function testWhatIfScenarios() {
  console.log('🚀 Starting What-If Scenarios Test\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Listen to console logs from the page
    page.on('console', msg => {
      if (msg.text().includes('🔍') || msg.text().includes('🧮') || msg.text().includes('📊')) {
        console.log('Browser Console:', msg.text());
      }
    });
    
    console.log('📱 Navigating to login page...');
    await page.goto('http://localhost:3000/auth/login');
    
    console.log('🔐 Logging in with test credentials...');
    await page.type('input[name="email"]', 'john@doe.com');
    await page.type('input[name="password"]', 'johndoe123');
    await page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard
    await page.waitForNavigation();
    console.log('✅ Successfully logged in');
    
    // Navigate to tax filing
    console.log('📊 Navigating to tax filing...');
    await page.goto('http://localhost:3000/dashboard');
    
    // Look for the tax return link and click it
    await page.waitForSelector('a[href*="/tax-filing/"]', { timeout: 10000 });
    await page.click('a[href*="/tax-filing/"]');
    
    // Wait for the tax filing page to load
    await page.waitForNavigation();
    console.log('📋 Tax filing page loaded');
    
    // Navigate to deductions step (usually step 4 or 5)
    // Look for deductions step - might be in a stepper or navigation
    await page.waitForTimeout(2000);
    
    // Try to find and click on deductions step
    const deductionsButton = await page.$('button:contains("Deductions")') || 
                            await page.$('a:contains("Deductions")') ||
                            await page.$('[data-step="deductions"]');
    
    if (deductionsButton) {
      await deductionsButton.click();
      console.log('🧾 Navigated to deductions step');
    }
    
    // Wait for the what-if scenarios component to load
    await page.waitForTimeout(3000);
    
    // Check if the what-if scenarios component is present
    const whatIfSection = await page.$('text/Interactive What-If Scenarios');
    if (whatIfSection) {
      console.log('✅ What-If Scenarios component found!');
      
      // Check for debug info
      const debugInfo = await page.$('text/Debug Info');
      if (debugInfo) {
        console.log('🔍 Debug information is present');
        await debugInfo.click(); // Expand debug info
        await page.waitForTimeout(1000);
      }
      
      // Check the scenario calculations
      const scenarios = await page.$$eval('[data-testid="scenario"], .scenario', elements => 
        elements.map(el => el.textContent)
      );
      
      console.log('📊 Found scenarios:', scenarios.length);
      
      // Look for tax amounts in the scenarios
      const taxAmounts = await page.$$eval('text/Tax:, text/Saves:', elements =>
        elements.map(el => el.textContent)
      );
      
      console.log('💰 Tax amounts found:', taxAmounts);
      
      if (taxAmounts.some(amount => amount.includes('$0'))) {
        console.log('❌ Still showing $0 amounts - issue not fully resolved');
      } else {
        console.log('✅ Real tax amounts are being displayed!');
      }
      
    } else {
      console.log('❌ What-If Scenarios component not found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
    console.log('🔚 Test completed');
  }
}

// Check if puppeteer is available, if not, do a simple curl test
try {
  testWhatIfScenarios();
} catch (error) {
  console.log('📝 Puppeteer not available, doing simple test...');
  
  // Simple test - just check if the pages are accessible
  const { execSync } = require('child_process');
  
  try {
    console.log('Testing login page...');
    execSync('curl -s http://localhost:3000/auth/login | grep -q "Sign in"');
    console.log('✅ Login page accessible');
    
    console.log('Testing home page...');
    execSync('curl -s http://localhost:3000 | grep -q "TaxGrok"');
    console.log('✅ Home page accessible');
    
    console.log('ℹ️  Manual test required: Please sign in at http://localhost:3000/auth/login with john@doe.com / johndoe123');
    
  } catch (err) {
    console.error('❌ Basic connectivity test failed:', err.message);
  }
}
