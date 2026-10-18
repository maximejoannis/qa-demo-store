/**
 * Deliberate defects for QA training. They only apply to the matching demo account,
 * when faults are enabled. The engine itself never contains a defect.
 */
export const FAULTS = [
  { id: 'FAULT-PRB-01', profile: 'problem', layer: 'api' },
  { id: 'FAULT-PRB-02', profile: 'problem', layer: 'api' },
  { id: 'FAULT-PRB-03', profile: 'problem', layer: 'web' },
  { id: 'FAULT-GLT-01', profile: 'glitch', layer: 'api' },
  { id: 'FAULT-GLT-02', profile: 'glitch', layer: 'api' },
  { id: 'FAULT-ERR-01', profile: 'error', layer: 'api' },
  { id: 'FAULT-ERR-02', profile: 'error', layer: 'web' },
  { id: 'FAULT-RND-01', profile: 'rounding', layer: 'api' },
  { id: 'FAULT-RND-02', profile: 'rounding', layer: 'api' },
  { id: 'FAULT-A11Y-01', profile: 'a11y', layer: 'web' },
  { id: 'FAULT-A11Y-02', profile: 'a11y', layer: 'web' },
  { id: 'FAULT-A11Y-03', profile: 'a11y', layer: 'web' },
  { id: 'FAULT-I18N-01', profile: 'i18n', layer: 'web' },
  { id: 'FAULT-I18N-02', profile: 'i18n', layer: 'web' },
];

export function faultActive(id, user, config) {
  if (!config.faultsEnabled || !user?.faultProfile) return false;
  return FAULTS.some((fault) => fault.id === id && fault.profile === user.faultProfile);
}

export const GLITCH_DELAY_MS = 3000;
