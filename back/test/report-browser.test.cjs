const { test } = require('node:test');
const assert = require('node:assert/strict');
const serverlessChromium = require('@sparticuz/chromium');
const { chromium } = require('playwright');

function loadLauncher() {
  const path = require.resolve('../dist/src/reports/report-browser');
  delete require.cache[path];
  return require(path).launchReportBrowser;
}

function setVercel(t, value) {
  const previous = process.env.VERCEL;
  if (value === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = value;
  t.after(() => {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
    t.mock.restoreAll();
  });
}

test('local reports use the installed Playwright browser', async (t) => {
  setVercel(t, undefined);
  t.mock.method(serverlessChromium, 'executablePath', async () => {
    assert.fail('Local reports must not extract the Linux binary');
  });
  t.mock.method(chromium, 'launch', async (options) => {
    assert.deepEqual(options, { headless: true });
    return 'local-browser';
  });
  assert.equal(await loadLauncher()(), 'local-browser');
});

test('concurrent Vercel reports share extraction and launch separate browsers', async (t) => {
  setVercel(t, '1');
  let finishExtraction;
  const extraction = new Promise((resolve) => { finishExtraction = resolve; });
  const executable = t.mock.method(serverlessChromium, 'executablePath', () => extraction);
  const launch = t.mock.method(chromium, 'launch', async (options) => {
    assert.equal(options.executablePath, '/tmp/chromium');
    assert.deepEqual(options.args, serverlessChromium.args);
    assert.equal(options.headless, true);
    return {};
  });
  const launchReportBrowser = loadLauncher();
  const first = launchReportBrowser();
  const second = launchReportBrowser();
  assert.equal(executable.mock.callCount(), 1);
  assert.equal(launch.mock.callCount(), 0);
  finishExtraction('/tmp/chromium');
  const browsers = await Promise.all([first, second]);
  assert.notEqual(browsers[0], browsers[1]);
  assert.equal(launch.mock.callCount(), 2);
});

test('a failed extraction can be retried on the next request', async (t) => {
  setVercel(t, '1');
  let attempts = 0;
  t.mock.method(serverlessChromium, 'executablePath', async () => {
    if (++attempts === 1) throw new Error('Extraction failed');
    return '/tmp/chromium';
  });
  t.mock.method(chromium, 'launch', async () => 'browser');
  const launchReportBrowser = loadLauncher();
  await assert.rejects(launchReportBrowser(), /Extraction failed/);
  assert.equal(await launchReportBrowser(), 'browser');
  assert.equal(attempts, 2);
});
