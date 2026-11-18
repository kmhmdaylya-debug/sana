const lighthouse = require('lighthouse').default;
const chromeLauncher = require('chrome-launcher');

async function runLighthouse(url, config = {}) {
  const chrome = await chromeLauncher.launch({ 
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'] 
  });
  
  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    port: chrome.port,
    ...config,
  };
  
  const runnerResult = await lighthouse(url, options);
  await chrome.kill();
  
  const report = runnerResult.lhr;
  return {
    performance: report.categories.performance.score * 100,
    accessibility: report.categories.accessibility.score * 100,
    bestPractices: report.categories['best-practices'].score * 100,
    seo: report.categories.seo.score * 100,
    metrics: {
      fcp: report.audits['first-contentful-paint'].numericValue,
      lcp: report.audits['largest-contentful-paint'].numericValue,
      tbt: report.audits['total-blocking-time'].numericValue,
      cls: report.audits['cumulative-layout-shift'].numericValue,
      speedIndex: report.audits['speed-index'].numericValue,
      interactive: report.audits['interactive'].numericValue,
    },
    rawReport: report,
  };
}

async function main() {
  const urls = [
    { name: 'Dashboard', url: 'http://localhost:5183/' },
    { name: 'Employees', url: 'http://localhost:5183/employees' },
    { name: 'Leaves', url: 'http://localhost:5183/leaves' },
    { name: 'Payroll', url: 'http://localhost:5183/payroll' },
    { name: 'Tasks', url: 'http://localhost:5183/tasks' },
    { name: 'Login', url: 'http://localhost:5183/login' },
  ];
  
  console.log('🚀 Running Lighthouse Performance Audits\n');
  console.log('=' .repeat(80));
  
  const results = [];
  
  for (const { name, url } of urls) {
    console.log(`\n📊 Auditing ${name} (${url})...`);
    try {
      // Run desktop audit
      const desktop = await runLighthouse(url, { 
        formFactor: 'desktop',
        screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
      });
      
      // Run mobile audit
      const mobile = await runLighthouse(url, { 
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 375, height: 667, deviceScaleFactor: 2.625, disabled: false },
        throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 }
      });
      
      results.push({ name, url, desktop, mobile });
      
      console.log(`  Desktop: Performance=${desktop.performance.toFixed(0)}, Accessibility=${desktop.accessibility.toFixed(0)}, Best Practices=${desktop.bestPractices.toFixed(0)}, SEO=${desktop.seo.toFixed(0)}`);
      console.log(`  Mobile:  Performance=${mobile.performance.toFixed(0)}, Accessibility=${mobile.accessibility.toFixed(0)}, Best Practices=${mobile.bestPractices.toFixed(0)}, SEO=${mobile.seo.toFixed(0)}`);
      console.log(`  Mobile Metrics: FCP=${mobile.metrics.fcp.toFixed(0)}ms, LCP=${mobile.metrics.lcp.toFixed(0)}ms, TBT=${mobile.metrics.tbt.toFixed(0)}ms, CLS=${mobile.metrics.cls.toFixed(3)}`);
      
    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}`);
      results.push({ name, url, error: error.message });
    }
  }
  
  console.log('\n' + '=' .repeat(80));
  console.log('📋 LIGHTHOUSE SUMMARY');
  console.log('=' .repeat(80));
  
  for (const r of results) {
    if (r.error) {
      console.log(`❌ ${r.name}: ${r.error}`);
      continue;
    }
    
    const mobilePerf = r.mobile.performance;
    const desktopPerf = r.desktop.performance;
    const status = mobilePerf >= 85 ? '✅ PASS' : mobilePerf >= 70 ? '⚠️ NEEDS IMPROVEMENT' : '❌ FAIL';
    
    console.log(`${status} ${r.name}: Mobile=${mobilePerf.toFixed(0)}, Desktop=${desktopPerf.toFixed(0)}`);
  }
  
  // Save detailed results
  const fs = require('fs');
  fs.writeFileSync('lighthouse-results.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Detailed results saved to lighthouse-results.json');
}

main().catch(console.error);