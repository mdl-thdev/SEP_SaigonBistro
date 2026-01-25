// SEP_SaigonBistro/backend/src/utils/constants.js

const TICKET_STATUSES = new Set([
  "New",
  "Pending Review",
  "Waiting Customer Response",
  "Resolved",
  "Reopened"
]);

module.exports = { TICKET_STATUSES };
