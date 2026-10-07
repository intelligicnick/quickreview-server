export const DESIGN_TEMPLATES = ['sale', 'festival', 'cta', 'hours', 'new', 'custom'] as const;
export type DesignTemplate = (typeof DESIGN_TEMPLATES)[number];

export const DESIGN_LOOKS = [
  'festival-gold',
  'hot-sale',
  'night-glam',
  'soft-spa',
  'clean',
  'royal',
] as const;
export type DesignLook = (typeof DESIGN_LOOKS)[number];

export const DESIGN_LOOK_HINTS: Record<DesignLook, string> = {
  'festival-gold':
    'Mood only: deep chocolate and warm gold, festive lamps and glow, slow premium energy.',
  'hot-sale': 'Mood only: vivid red and cream, loud urgent sale energy, high contrast.',
  'night-glam': 'Mood only: dark navy, neon cyan and pink, urban night, glowing accents.',
  'soft-spa': 'Mood only: blush, cream and lavender, airy boutique spa, gentle light.',
  clean: 'Mood only: off-white, black type, quiet editorial, modern, lots of space.',
  royal: 'Mood only: matte black and gold, exclusive invitation, evening luxury.',
};

export const DESIGN_PICTURE_MODES = ['photos', 'design'] as const;
export type DesignPictureMode = (typeof DESIGN_PICTURE_MODES)[number];

export const DESIGN_PICTURE_HINTS: Record<DesignPictureMode, string> = {
  photos:
    'Include rich photographic scenes that fit this local business (people at work, hands, interior, product). A hero photo plus smaller service shots is good. Invent plausible photography. No celebrities, no real brand logos, no readable phone numbers or shop names.',
  design:
    'Graphic poster only: colour, type, shapes, ornaments. No photographs of people or interiors.',
};

export const DESIGN_DAILY_LIMIT = 5;
export const DESIGN_MONTHLY_LIMIT = 20;
export const DESIGN_ASPECT_RATIO = '9:16';

export const DESIGN_ASPECT_RATIOS = ['9:16', '1:1', '4:5'] as const;
export type DesignAspectRatio = (typeof DESIGN_ASPECT_RATIOS)[number];

export const DESIGN_ASPECT_RATIO_META: Record<DesignAspectRatio, { label: string; channel: string }> = {
  '9:16': { label: 'Story 9:16', channel: 'WhatsApp Status · Instagram Stories' },
  '1:1': { label: 'Square 1:1', channel: 'Instagram · Facebook post' },
  '4:5': { label: 'Portrait 4:5', channel: 'Instagram feed' },
};
