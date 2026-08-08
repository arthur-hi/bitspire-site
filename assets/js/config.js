export const SITE_CONFIG = Object.freeze({
  supabaseUrl: "https://qodebrpdmgqmdwtaysjf.supabase.co",
  supabasePublishableKey: "sb_publishable_rIC-VDBRaX71ouxxkNr_Yw_CKzKQHcY",
});

export function checkSiteConfig() {
  if (
    SITE_CONFIG.supabaseUrl.includes("replace-this-project") ||
    SITE_CONFIG.supabasePublishableKey.startsWith("replace-with")
  ) {
    throw new Error("The site has no Supabase project configuration.");
  }
}

export function getFunctionUrl(functionName) {
  checkSiteConfig();
  return new URL(
    `/functions/v1/${functionName}`,
    SITE_CONFIG.supabaseUrl,
  ).toString();
}
