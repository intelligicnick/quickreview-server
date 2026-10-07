import { BadGatewayException, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants';
import { GoogleOAuthService } from './google-oauth.service';
import type { GbpLocationRow } from './google.types';

type AccountList = { accounts?: { name?: string }[] };
type LocationList = {
  locations?: GbpApiLocation[];
  nextPageToken?: string;
};

type GbpApiLocation = {
  name?: string;
  title?: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
  };
  phoneNumbers?: { primaryPhone?: string };
  websiteUri?: string;
  metadata?: { placeId?: string };
  categories?: { primaryCategory?: { displayName?: string; name?: string } };
};

@Injectable()
export class GoogleBusinessService {
  constructor(private readonly oauth: GoogleOAuthService) {}

  async listManagedLocations(userId: string): Promise<GbpLocationRow[]> {
    const accessToken = await this.oauth.getAccessToken(userId);
    const accounts = await this.fetchAccounts(accessToken);
    const rows: GbpLocationRow[] = [];
    for (const account of accounts) {
      if (!account.name) continue;
      const locations = await this.fetchLocations(accessToken, account.name);
      rows.push(...locations);
    }
    return rows;
  }

  private async fetchAccounts(accessToken: string): Promise<{ name?: string }[]> {
    const url = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new BadGatewayException({
        code: ERROR_CODES.INTERNAL_ERROR,
        message: `Google Business accounts failed (${response.status}): ${text.slice(0, 200)}`,
      });
    }
    const json = (await response.json()) as AccountList;
    return json.accounts ?? [];
  }

  private async fetchLocations(accessToken: string, accountName: string): Promise<GbpLocationRow[]> {
    const readMask = [
      'name',
      'title',
      'storefrontAddress',
      'phoneNumbers',
      'websiteUri',
      'metadata',
      'categories',
    ].join(',');
    const rows: GbpLocationRow[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ readMask, pageSize: '100' });
      if (pageToken) params.set('pageToken', pageToken);
      const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?${params}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new BadGatewayException({
          code: ERROR_CODES.INTERNAL_ERROR,
          message: `Google Business locations failed (${response.status}): ${text.slice(0, 200)}`,
        });
      }
      const json = (await response.json()) as LocationList;
      for (const loc of json.locations ?? []) {
        rows.push(this.toRow(loc));
      }
      pageToken = json.nextPageToken;
    } while (pageToken);
    return rows;
  }

  private toRow(loc: GbpApiLocation): GbpLocationRow {
    const lines = loc.storefrontAddress?.addressLines ?? [];
    const city = loc.storefrontAddress?.locality;
    const state = loc.storefrontAddress?.administrativeArea;
    const pin = loc.storefrontAddress?.postalCode;
    const formattedAddress = [...lines, city, state, pin].filter(Boolean).join(', ') || null;
    const category =
      loc.categories?.primaryCategory?.displayName ??
      loc.categories?.primaryCategory?.name ??
      null;
    return {
      gbpLocationName: loc.name ?? '',
      title: loc.title?.trim() || 'Untitled location',
      placeId: loc.metadata?.placeId?.trim() || null,
      formattedAddress,
      phone: loc.phoneNumbers?.primaryPhone?.trim() || null,
      website: loc.websiteUri?.trim() || null,
      primaryCategory: category,
    };
  }
}
