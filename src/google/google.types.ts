export type PlaceSnapshot = {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  phone: string | null;
  website: string | null;
  primaryType: string | null;
  primaryTypeDisplay: string | null;
  types: string[];
  rating: number | null;
  reviewCount: number | null;
};

export type GbpLocationRow = {
  gbpLocationName: string;
  title: string;
  placeId: string | null;
  formattedAddress: string | null;
  phone: string | null;
  website: string | null;
  primaryCategory: string | null;
};
