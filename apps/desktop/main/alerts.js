/**
 * Alerts module — email sending is routed through the Edge Function.
 * No Resend API key is needed on the client.
 *
 * This module is kept as a thin wrapper so existing call sites
 * (capture.js pause alerts, ipc.js partner invitations) continue to work
 * without changing their interface.
 */

const { callEdgeFunction, getAccessToken } = require("./api-client");

async function sendAlertEmail(type, partnerEmail, userName, data) {
  const token = getAccessToken();
  if (!token) {
    console.log(`[Alerts] No access token - skipping ${type} email to ${partnerEmail}`);
    return null;
  }

  try {
    const result = await callEdgeFunction("alerts.sendEmail", {
      type,
      to: partnerEmail,
      userName,
      data: data || {},
    }, token);

    console.log(`[Alerts] ${type} email sent to ${partnerEmail}`);
    return result;
  } catch (err) {
    console.error(`[Alerts] Failed to send ${type} email:`, err.message);
    return null;
  }
}

module.exports = { sendAlertEmail };
