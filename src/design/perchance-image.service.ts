import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DesignAspectRatio } from './design.constants';

const GENERATE_URL = 'https://image-generation.perchance.org/api/generate';
const DOWNLOAD_URL = 'https://image-generation.perchance.org/api/downloadTemporaryImage';

const CHANNELS = ['ai-text-to-image-generator', 'image-generator-professional'] as const;

/** Realistic style tails (random pick) — mimics “realistic” generator variety on Perchance. */
const REALISTIC_STYLE_TAILS = [
  'photorealistic, professional commercial photography, sharp focus',
  'ultra realistic, natural lighting, DSLR quality',
  'hyperrealistic marketing photo, clean composition',
  'realistic studio shot, soft shadows, high detail',
  'lifelike product photography, vivid but natural colors',
];

const NEGATIVE =
  'blurry, watermark, ugly text, misspelled text, low quality, deformed, cartoon';

const ACCESS_CODE_URL = 'https://perchance.org/api/getAccessCodeForAdPoweredStuff';
const CHECK_VERIFICATION_URL =
  'https://image-generation.perchance.org/api/checkVerificationStatus';

const BROWSER_HEADERS: Record<string, string> = {
  Accept: '*/*',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Referer: 'https://perchance.org/ai-text-to-image-generator',
  Origin: 'https://perchance.org',
};

/** ponytail: in-memory cache only; multi-instance deploy needs PERCHANCE_USER_KEY env. */
const SESSION_TTL_MS = 25_000;

export function perchanceResolution(aspect: DesignAspectRatio): string {
  const map: Record<DesignAspectRatio, string> = {
    '9:16': '768x1344',
    '1:1': '1024x1024',
    '4:5': '1024x1280',
  };
  return map[aspect];
}

function pickRealisticTail(): string {
  return REALISTIC_STYLE_TAILS[Math.floor(Math.random() * REALISTIC_STYLE_TAILS.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class PerchanceImageService {
  private readonly logger = new Logger(PerchanceImageService.name);
  private cachedSession: { userKey: string; adAccessCode?: string; fetchedAt: number } | null =
    null;

  constructor(private readonly config: ConfigService) {}

  /** True when the API will attempt server-side Perchance (no browser key prompt). */
  isConfigured(): boolean {
    const envKey = this.config.get<string>('PERCHANCE_USER_KEY')?.trim();
    if (envKey && envKey.length >= 32) return true;
    const auto = this.config.get<string>('PERCHANCE_AUTO_SESSION')?.trim().toLowerCase();
    return auto !== 'false' && auto !== '0';
  }

  async generate(prompt: string, aspectRatio: DesignAspectRatio): Promise<{ bytes: Buffer; mimeType: string }> {
    const { userKey, adAccessCode } = await this.resolveSession();

    const resolution = perchanceResolution(aspectRatio);
    const styledPrompt = `${prompt.trim()}, ${pickRealisticTail()}`;
    let lastError = 'Perchance did not return an image';

    for (const channel of CHANNELS) {
      try {
        const imageId = await this.requestImageId(
          userKey,
          styledPrompt,
          resolution,
          channel,
          adAccessCode,
        );
        const bytes = await this.downloadImage(imageId);
        return { bytes, mimeType: 'image/jpeg' };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Perchance channel ${channel} failed: ${lastError}`);
        if (lastError.includes('invalid') && lastError.includes('key')) {
          this.cachedSession = null;
        }
      }
    }

    throw new BadGatewayException(`Perchance image failed: ${lastError}`);
  }

  private async resolveSession(): Promise<{ userKey: string; adAccessCode?: string }> {
    const envKey = this.config.get<string>('PERCHANCE_USER_KEY')?.trim();
    if (envKey && envKey.length >= 32) {
      return { userKey: envKey };
    }

    const now = Date.now();
    if (
      this.cachedSession &&
      now - this.cachedSession.fetchedAt < SESSION_TTL_MS &&
      (await this.isUserKeyUsable(this.cachedSession.userKey))
    ) {
      return {
        userKey: this.cachedSession.userKey,
        adAccessCode: this.cachedSession.adAccessCode,
      };
    }

    const accessCode = await this.fetchAdAccessCode();
    if (!accessCode) {
      throw new BadGatewayException(
        'Perchance session could not be started on the server. Set PERCHANCE_USER_KEY in server/.env (copy userKey once from perchance.org network tab) or ensure the API can reach perchance.org.',
      );
    }

    this.cachedSession = { userKey: accessCode, adAccessCode: accessCode, fetchedAt: now };
    return { userKey: accessCode, adAccessCode: accessCode };
  }

  private async fetchAdAccessCode(): Promise<string | null> {
    try {
      const response = await fetch(ACCESS_CODE_URL, { headers: BROWSER_HEADERS });
      if (!response.ok) {
        this.logger.warn(`Perchance access code HTTP ${response.status}`);
        return null;
      }
      const text = (await response.text()).trim();
      const match = text.match(/^[a-f0-9]{64}$/i);
      return match ? match[0] : null;
    } catch (err) {
      this.logger.warn(
        `Perchance access code fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async isUserKeyUsable(userKey: string): Promise<boolean> {
    try {
      const params = new URLSearchParams({
        userKey,
        __cacheBust: String(Math.random()),
      });
      const response = await fetch(`${CHECK_VERIFICATION_URL}?${params.toString()}`, {
        headers: { Accept: 'application/json', ...BROWSER_HEADERS },
      });
      const text = await response.text();
      if (text.startsWith('<!DOCTYPE')) {
        return true;
      }
      return !text.includes('not_verified');
    } catch {
      return false;
    }
  }

  private async requestImageId(
    userKey: string,
    prompt: string,
    resolution: string,
    channel: string,
    adAccessCode?: string,
  ): Promise<string> {
    const requestId = Math.random();
    const params = new URLSearchParams({
      prompt: `'${prompt.replace(/'/g, '')}`,
      negativePrompt: `'${NEGATIVE}`,
      userKey,
      __cacheBust: String(Math.random()),
      seed: '-1',
      resolution,
      guidanceScale: '7',
      channel,
      subChannel: 'public',
      requestId: String(requestId),
    });
    if (adAccessCode) {
      params.set('adAccessCode', adAccessCode);
    }

    const deadline = Date.now() + 90_000;
    let response = await fetch(`${GENERATE_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`generate HTTP ${response.status}`);
    }

    while (Date.now() < deadline) {
      const body = await response.text();
      if (body.includes('invalid_key')) {
        throw new Error('invalid Perchance user key — refresh PERCHANCE_USER_KEY');
      }
      try {
        const json = JSON.parse(body) as { imageId?: string };
        if (json.imageId) return json.imageId;
      } catch {
        // still processing
      }
      await sleep(4_000);
      response = await fetch(`${GENERATE_URL}?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`generate poll HTTP ${response.status}`);
      }
    }
    throw new Error('timed out waiting for Perchance image');
  }

  private async downloadImage(imageId: string): Promise<Buffer> {
    const url = `${DOWNLOAD_URL}?${new URLSearchParams({ imageId }).toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`download HTTP ${response.status}`);
    }
    const array = await response.arrayBuffer();
    if (array.byteLength < 100) {
      throw new Error('empty image from Perchance');
    }
    return Buffer.from(array);
  }
}
