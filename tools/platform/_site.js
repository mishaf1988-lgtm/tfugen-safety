// The settings of a new factory (17/10/2026, "product for sale" step 2). tools/export-platform.mjs
// puts this file in place of functions/_site.js in the safety-platform copy, so no value of the
// source factory leaves its repo. A new factory fills in every value below, then runs
//   node tests/harness/site-config-test.mjs --write
// which writes the page's copy, the app name and the tab icon letter from here.
// The keys must stay the same as in functions/_site.js; the export fails when they differ.

const HOST = 'your-factory-safety.pages.dev';
const MANAGER_EMAIL = 'safety@example.com';
const OWNER = '\u05de\u05de\u05d5\u05e0\u05d4 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea';  // the safety manager who runs the app
const COMPANY = '\u05e9\u05dd \u05d4\u05de\u05e4\u05e2\u05dc';
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const SITE = {
  name: 'Safety Platform',                             // page titles, mail subjects
  brand: 'Safety',                                     // the short Latin name (print headers, logo text)
  slug: 'safety-platform',                             // User-Agent toward GitHub
  shortName: '\u05de\u05e2\u05e8\u05db\u05ea \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea', // the logo's alt text
  owner: OWNER,                                        // page footers, the default auditor and signer, mail sign-offs
  ownerTitle: '\u05de\u05de\u05d5\u05e0\u05d4 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea', // under the owner's name in mails to people
  company: COMPANY,                                    // footers of mails and pages
  companyEn: 'Your Factory',                           // the AI prompts ("a safety expert at ...")
  filePrefix: 'safety',                                // names of files the app downloads
  host: HOST,
  appUrl: 'https://' + HOST,
  previewRe: new RegExp('^https://[a-z0-9-]+\\.' + reEsc(HOST) + '$'),
  previewHostRe: new RegExp('\\.' + reEsc(HOST) + '$', 'i'),
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabaseKey: 'YOUR-PUBLISHABLE-KEY',                 // public by design (RLS guards the rows)
  stagingSupabaseUrl: 'https://YOUR-TEST-PROJECT.supabase.co', // the test database of a preview build
  stagingSupabaseKey: 'YOUR-TEST-PUBLISHABLE-KEY',
  loginDomain: 'factory.local',                        // a login is <username>@<loginDomain>
  adminEmail: 'admin@factory.local',
  managerEmail: MANAGER_EMAIL,
  mailDomain: '@example.com',                          // mail-inbox: only senders from here
  hrEmail: 'hr@example.com',                           // induction forms go here
  odRoot: 'Apps/Safety Platform',                      // the app's folder in OneDrive
  odFileUrl: 'https://YOUR-TENANT-my.sharepoint.com/personal/YOUR_USER/', // the OneDrive owner's site, for file links
  backupPrefix: 'safety-backup',                       // names of the backup files
  codeRepos: [],                                       // [['owner/repo', isPrivate]] the weekly code backup zips
  assistantQueue: '', // the researcher's queue the weekly digest reads (GitHub contents API); '' = none
  // WhatsApp templates as approved by Meta for this account. The server sends the first two.
  waTemplates: { dedicated: 'safety_report', fallback: 'incident_alert', ncrCritical: 'ncr_critical',
    taskOverdue: 'task_overdue', expiryWarning: 'expiry_warning', roundMissed: 'round_missed' },
  wabaId: '',
  // The factory's departments. depts: the hazard register and the department report (maintenance
  // is added to the report by itself). areaDept: a trustee's area -> its department, e.g.
  // { 'Packing': 'Production' }; an area not here is "no department". tbtDepts: the weekly
  // training forms, each with the department names on the employee cards. tbtReport: training
  // department -> department of the report (one of depts, or maintenance).
  depts: ['\u05d9\u05d9\u05e6\u05d5\u05e8', '\u05d0\u05e8\u05d9\u05d6\u05d4', '\u05de\u05d7\u05e1\u05e0\u05d9\u05dd'],
  areaDept: {},
  tbtDepts: [['\u05d9\u05d9\u05e6\u05d5\u05e8', ['\u05d9\u05d9\u05e6\u05d5\u05e8']], ['\u05d0\u05e8\u05d9\u05d6\u05d4', ['\u05d0\u05e8\u05d9\u05d6\u05d4']], ['\u05de\u05d7\u05e1\u05e0\u05d9\u05dd', ['\u05de\u05d7\u05e1\u05e0\u05d9\u05dd']], ['\u05d0\u05d7\u05d6\u05e7\u05d4', ['\u05d0\u05d7\u05d6\u05e7\u05d4']]],
  tbtReport: {'\u05d9\u05d9\u05e6\u05d5\u05e8': '\u05d9\u05d9\u05e6\u05d5\u05e8', '\u05d0\u05e8\u05d9\u05d6\u05d4': '\u05d0\u05e8\u05d9\u05d6\u05d4', '\u05de\u05d7\u05e1\u05e0\u05d9\u05dd': '\u05de\u05d7\u05e1\u05e0\u05d9\u05dd', '\u05d0\u05d7\u05d6\u05e7\u05d4': '\u05d0\u05d7\u05d6\u05e7\u05d4'},
  // The annual training plan a new year starts from: [item, subject, who trains, audience].
  // trainPlanAuto: item -> [talk kind, subject] of a closed talk that marks it done; {} = by hand only.
  trainPlan: [
    [1, '\u05d4\u05d3\u05e8\u05db\u05ea \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05e9\u05e0\u05ea\u05d9\u05ea', '\u05de\u05de\u05d5\u05e0\u05d4 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea', '\u05db\u05dc \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd'],
    [2, '\u05e2\u05d6\u05e8\u05d4 \u05e8\u05d0\u05e9\u05d5\u05e0\u05d4', '\u05de\u05d3\u05e8\u05d9\u05da \u05e2\u05d6\u05e8\u05d4 \u05e8\u05d0\u05e9\u05d5\u05e0\u05d4', '\u05e6\u05d5\u05d5\u05ea \u05e2\u05d6\u05e8\u05d4 \u05e8\u05d0\u05e9\u05d5\u05e0\u05d4'],
    [3, '\u05db\u05d9\u05d1\u05d5\u05d9 \u05d0\u05e9 \u05d5\u05e0\u05d4\u05dc\u05d9 \u05d7\u05d9\u05e8\u05d5\u05dd', '\u05de\u05de\u05d5\u05e0\u05d4 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea', '\u05db\u05dc \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd'],
    [4, '\u05d7\u05d5\u05de\u05e8\u05d9\u05dd \u05de\u05e1\u05d5\u05db\u05e0\u05d9\u05dd', '\u05de\u05de\u05d5\u05e0\u05d4 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea', '\u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05e2\u05dd \u05d7\u05d5\u05de\u05e8\u05d9\u05dd \u05de\u05e1\u05d5\u05db\u05e0\u05d9\u05dd'],
    [5, '\u05d4\u05d3\u05e8\u05db\u05d5\u05ea \u05d0\u05d9\u05db\u05d5\u05ea \u05e1\u05d1\u05d9\u05d1\u05d4', '\u05de\u05de\u05d5\u05e0\u05d4 \u05d0\u05d9\u05db\u05d5\u05ea \u05e1\u05d1\u05d9\u05d1\u05d4', '\u05db\u05dc \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd'],
    [6, '\u05d4\u05d3\u05e8\u05db\u05d5\u05ea \u05e0\u05d5\u05e1\u05e4\u05d5\u05ea \u05dc\u05e4\u05d9 \u05e6\u05e8\u05db\u05d9\u05dd \u05e9\u05d9\u05d6\u05d5\u05d4\u05d5', '', '']
  ],
  trainPlanAuto: {},
  // The manager's mail signature, under every hazard report.
  // The agents in agents/ and the days after which a silent one turns red in the weekly mail.
  agentPeriods: { compliance: 35, trends: 35, inspector: 35, 'talk-field': 8 },
  signature: '<div style="margin-top:16px;font-family:Arial,sans-serif;font-size:14px">\u05d1\u05d1\u05e8\u05db\u05d4,<br><br><b>' + OWNER + '.</b><br>' + COMPANY + '<br><a href="mailto:' + MANAGER_EMAIL + '">' + MANAGER_EMAIL + '</a></div>'
};

// The words that give this factory away (its Latin name, its Hebrew name, the database id),
// for tests/harness/site-config-test.mjs: it fails when one shows up outside this file.
// Matches nothing until filled in, e.g. /myfactory|\\u05e9\\u05dd|&#1513;&#1501;/i.
export const NAMES_RE = /(?!)/;

export const CLIENT_KEYS = ['name', 'brand', 'slug', 'shortName', 'owner', 'company', 'companyEn', 'filePrefix', 'host', 'appUrl',
  'supabaseUrl', 'supabaseKey', 'stagingSupabaseUrl', 'stagingSupabaseKey', 'loginDomain', 'adminEmail', 'managerEmail',
  'mailDomain', 'odRoot', 'backupPrefix', 'waTemplates', 'depts', 'areaDept', 'tbtDepts', 'trainPlan', 'trainPlanAuto'];
export const clientSite = () => Object.fromEntries(CLIENT_KEYS.map((k) => [k, SITE[k]]));
