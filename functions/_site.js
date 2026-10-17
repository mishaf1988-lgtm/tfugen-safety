// Everything on the server that names this factory, in one place (17/10/2026, DECISIONS
// "product for sale", step 1). A new factory changes this file and _logo.js (the logo itself);
// no other file under functions/ names the company, its domain, its database or its
// OneDrive folders. tests/harness/site-config-test.mjs fails when one does.
// For Tapugan nothing changes: these are the values the files held as their own constants.

const HOST = 'tapugan-safety.pages.dev';
const MANAGER_EMAIL = 'sviva@tapugan.co.il';
const COMPANY = '\u05ea\u05e2\u05e9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df';
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const SITE = {
  name: 'Tapugan Safety',                              // page titles, mail subjects
  slug: 'tapugan-safety',                              // User-Agent toward GitHub
  shortName: '\u05ea\u05e4\u05d5\u05d2\u05df',         // the logo's alt text
  company: COMPANY,                                    // footers of mails and pages
  host: HOST,
  appUrl: 'https://' + HOST,
  previewRe: new RegExp('^https://[a-z0-9-]+\\.' + reEsc(HOST) + '$'),
  previewHostRe: new RegExp('\\.' + reEsc(HOST) + '$', 'i'),
  supabaseUrl: 'https://znhjtpcltrxxyfjczgvw.supabase.co',
  loginDomain: 'tfugen.local',                         // a login is <username>@<loginDomain>
  adminEmail: 'admin@tfugen.local',
  managerEmail: MANAGER_EMAIL,
  mailDomain: '@tapugan.co.il',                        // mail-inbox: only senders from here
  hrEmail: 'hr-tap@tapugan.co.il',                     // induction forms go here
  odRoot: 'Apps/Tapugan Safety',                       // the app's folder in OneDrive
  odFileUrl: 'https://tapugancoil-my.sharepoint.com/personal/sviva_tapugan_co_il/',
  backupPrefix: 'tapugan-backup',                      // names of the files already in _Backups
  codeRepos: [['mishaf1988-lgtm/tfugen-safety', false], ['mishaf1988-lgtm/michael-skills', true]],
  waTemplates: { dedicated: 'tfugen_safety_report', fallback: 'tfugen_incident_alert' },
  wabaId: '4400035656982783',
  // The manager's Outlook signature (29/09/2026, from his screenshot), under every hazard report.
  signature: '<div style="margin-top:16px;font-family:Arial,sans-serif;font-size:14px">\u05d1\u05d1\u05e8\u05db\u05d4,<br><br><span style="color:#e00000;font-weight:bold">\u05de\u05d9\u05db\u05d0\u05dc \u05e4\u05e8\u05d9\u05d9\u05dc\u05d9\u05da.</span><br>\u05de\u05e0\u05d4\u05dc \u05d0\u05d9\u05db\u05d5\u05ea \u05d4\u05e1\u05d1\u05d9\u05d1\u05d4 \u05d5\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea(\u05de\u05de\u05d5\u05e0\u05d4 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea) // <span style="color:#e00000;font-weight:bold">' + COMPANY + ' \u05d1\u05e2&quot;\u05de</span><br><span style="font-size:12px"><span style="font-weight:bold">\u05e0\u05d9\u05d9\u05d3:</span> 0547940073 / <span style="font-weight:bold">\u05de\u05e9\u05e8\u05d3:</span> 08-6808365 / <a href="mailto:' + MANAGER_EMAIL + '" style="font-weight:bold">' + MANAGER_EMAIL + '</a></span><br><div style="border-top:2px solid #f5c400;width:340px;margin:12px 0"></div><a href="https://www.tapugan.co.il" style="color:#e00000;font-weight:bold">www.tapugan.co.il</a></div>'
};
