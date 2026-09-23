import serverlessChromium from '@sparticuz/chromium';
import { chromium } from 'playwright';

let executablePathPromise: Promise<string> | undefined;

export async function launchReportBrowser() {
  if (process.env.VERCEL !== '1') {
    return chromium.launch({ headless: true });
  }

  // Fluid Compute can start multiple reports at once. Extract the binary only once.
  executablePathPromise ??= serverlessChromium.executablePath().catch((error: unknown) => {
    executablePathPromise = undefined;
    throw error;
  });

  return chromium.launch({
    args: serverlessChromium.args,
    executablePath: await executablePathPromise,
    headless: true,
  });
}
