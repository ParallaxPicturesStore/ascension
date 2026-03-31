const { Resend } = require("resend");

let resend = null;

function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const TEMPLATES = {
  attempted_access: {
    subject: (name) => `${name} attempted to access blocked content`,
    html: (name, data) => `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 14px; letter-spacing: 3px; color: #1a3a5c; margin: 0;">ASCENSION</h1>
        </div>
        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
          At <strong>${data.time}</strong> on <strong>${data.date}</strong>, ${name} attempted to access an adult website.
        </p>
        <div style="background: #f8f7f5; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 14px; color: #6b6560;">
            The attempt was <strong style="color: #22c55e;">blocked successfully</strong>.
          </p>
          ${data.url ? `<p style="margin: 8px 0 0; font-size: 13px; color: #94a3b8;">URL: ${data.url}</p>` : ""}
        </div>
        <p style="font-size: 14px; color: #6b6560;">You may want to check in with ${name}.</p>
      </div>
    `,
  },

  content_detected: {
    subject: (name) => `${name} - content flagged on screen`,
    html: (name, data) => `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 14px; letter-spacing: 3px; color: #1a3a5c; margin: 0;">ASCENSION</h1>
        </div>
        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
          Ascension detected potentially explicit content on <strong>${name}</strong>'s screen at <strong>${data.time}</strong> on <strong>${data.date}</strong>.
        </p>
        <div style="background: #fef2f2; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 14px; color: #991b1b;">
            Confidence: <strong>${data.confidence}%</strong>
          </p>
          ${data.labels ? `<p style="margin: 8px 0 0; font-size: 13px; color: #94a3b8;">Labels: ${data.labels}</p>` : ""}
        </div>
        <p style="font-size: 14px; color: #6b6560;">A blurred screenshot is available in your partner dashboard.</p>
      </div>
    `,
  },

  evasion: {
    subject: (name) => `⚠️ ${name} - Ascension was disabled`,
    html: (name, data) => `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 14px; letter-spacing: 3px; color: #1a3a5c; margin: 0;">ASCENSION</h1>
        </div>
        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
          Ascension was <strong>${data.action}</strong> on <strong>${name}</strong>'s device at <strong>${data.time}</strong> on <strong>${data.date}</strong>.
        </p>
        <div style="background: #fff7ed; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 14px; color: #9a3412;">
            This may warrant a conversation.
          </p>
        </div>
      </div>
    `,
  },

  partner_invitation: {
    subject: (name) => `${name} added you as their accountability partner`,
    html: (name, data) => `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 14px; letter-spacing: 3px; color: #1a3a5c; margin: 0;">ASCENSION</h1>
        </div>
        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
          <strong>${name}</strong> has chosen you as their accountability partner on Ascension.
        </p>
        <div style="background: #f8f7f5; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #1a1a1a; font-weight: 600;">What this means:</p>
          <ul style="margin: 0; padding-left: 16px; font-size: 14px; color: #6b6560; line-height: 1.8;">
            <li>You'll receive alerts if flagged content is detected on their screen</li>
            <li>You'll be notified if they attempt to access blocked content</li>
            <li>You'll get a weekly progress report every Monday</li>
            <li>You'll be alerted if the app is disabled</li>
          </ul>
        </div>
        <p style="font-size: 14px; color: #6b6560; margin-bottom: 24px;">
          Create your free partner account to view their dashboard and full activity history.
        </p>
        <div style="text-align: center;">
          <a href="${data.signupUrl}" style="display: inline-block; background: #1a3a5c; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Set Up Your Account
          </a>
        </div>
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">
          You'll continue to receive alert emails regardless of whether you create an account.
        </p>
      </div>
    `,
  },

  // Sent to the USER when their subscription lapses
  subscription_lapse: {
    subject: () => `Your Ascension subscription has expired`,
    html: (name, data) => {
      const messages = {
        day1: {
          headline: "Your subscription has expired",
          body: "Your Ascension subscription ended today. Your accountability partner will no longer receive alerts if AI-powered monitoring is reduced.",
          urgency: "Renew now to keep your partner fully informed and maintain your streak.",
        },
        day7: {
          headline: "7 days without accountability",
          body: "It's been a week since your Ascension subscription expired. Your AI-powered screen monitoring is still active for now, but time is running out.",
          urgency: "Don't let a lapse in subscription become a lapse in your progress.",
        },
        day14: {
          headline: "2 weeks — AI monitoring ending soon",
          body: "Your subscription expired 14 days ago. In 16 days, AI-powered content detection will be reduced as your grace period ends.",
          urgency: "Renew before day 30 to keep full monitoring active.",
        },
        day30: {
          headline: "AI monitoring has ended",
          body: "Your 30-day grace period has ended. AI-powered content verification is now offline. Basic on-device monitoring continues, but your partner's alerts may be less reliable.",
          urgency: "Renew today to restore full protection.",
        },
      };
      const msg = messages[data.key] || messages.day1;
      return `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 14px; letter-spacing: 3px; color: #1a3a5c; margin: 0;">ASCENSION</h1>
          </div>
          <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px;">${msg.headline}</h2>
          <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">Hi ${name},</p>
          <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">${msg.body}</p>
          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px; color: #9a3412;">${msg.urgency}</p>
          </div>
          <div style="text-align: center;">
            <a href="https://getascension.app/pricing" style="display: inline-block; background: #1a3a5c; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
              Renew Subscription
            </a>
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">
            On-device monitoring and site blocking continue regardless of subscription status.
          </p>
        </div>
      `;
    },
  },

  // Sent to the PARTNER when the user's subscription lapses
  subscription_lapse_partner: {
    subject: (name) => `${name}'s Ascension subscription has expired`,
    html: (name, data) => {
      const messages = {
        day1: `${name}'s Ascension subscription expired today. AI-powered monitoring may be reduced if they don't renew.`,
        day7: `It's been 7 days since ${name}'s subscription expired. Consider checking in with them about renewing.`,
        day14: `${name}'s subscription has been expired for 14 days. AI monitoring will stop in 16 days if they don't renew.`,
        day30: `${name}'s 30-day grace period has ended. AI-powered content detection is now offline for their account. Ask them to renew to restore full accountability.`,
      };
      const body = messages[data.key] || messages.day1;
      return `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 14px; letter-spacing: 3px; color: #1a3a5c; margin: 0;">ASCENSION</h1>
          </div>
          <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">${body}</p>
          <div style="background: #f8f7f5; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px; color: #6b6560;">
              On-device site blocking on ${name}'s device continues regardless of subscription.
            </p>
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">
            You're receiving this as ${name}'s accountability partner on Ascension.
          </p>
        </div>
      `;
    },
  },

};

async function sendAlertEmail(type, partnerEmail, userName, data) {
  const client = getResend();
  if (!client) {
    console.log(`[Alerts] No Resend API key - skipping ${type} email to ${partnerEmail}`);
    return null;
  }

  const template = TEMPLATES[type];
  if (!template) {
    console.error(`[Alerts] Unknown alert type: ${type}`);
    return null;
  }

  const now = new Date();
  const enrichedData = {
    time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    date: now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
    ...data,
  };

  try {
    const result = await client.emails.send({
      from: "Ascension <alerts@getascension.app>",
      to: partnerEmail,
      subject: template.subject(userName),
      html: template.html(userName, enrichedData),
    });

    console.log(`[Alerts] ${type} email sent to ${partnerEmail} - ID: ${result.data?.id}`);
    return result;
  } catch (err) {
    console.error(`[Alerts] Failed to send ${type} email:`, err.message);
    return null;
  }
}

module.exports = { sendAlertEmail };
