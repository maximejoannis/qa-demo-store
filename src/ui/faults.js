/** Web-layer deliberate defects (the API-layer ones live in api-core). */
const WEB_FAULTS = {
  'FAULT-PRB-03': 'problem',
  'FAULT-ERR-02': 'error',
  'FAULT-A11Y-01': 'a11y',
  'FAULT-A11Y-02': 'a11y',
  'FAULT-A11Y-03': 'a11y',
  'FAULT-I18N-01': 'i18n',
  'FAULT-I18N-02': 'i18n',
};

export const webFault = (state, id) =>
  Boolean(state.user?.faultProfile && WEB_FAULTS[id] === state.user.faultProfile);
