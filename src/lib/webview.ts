/**
 * Detects common social-media in-app browsers that use isolated localStorage
 * containers. Cart data added in these WebViews may be lost when the user
 * switches to WhatsApp or their default browser.
 */
export const isInAppBrowser = (): boolean => {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Line\/|Twitter|Snapchat|TikTok|BytedanceWebview/i.test(ua);
};
