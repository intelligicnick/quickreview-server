import { BusinessCategory } from '../catalog/business-category.enum';
import { reviewAiPresetForCategory } from './review-ai-presets';

describe('reviewAiPresetForCategory', () => {
  it('returns services-oriented copy for professional services', () => {
    const preset = reviewAiPresetForCategory(BusinessCategory.SERVICES);
    expect(preset.questions[0].toLowerCase()).toContain('help');
    expect(preset.keywords.join(' ')).toMatch(/communication/i);
  });
});
