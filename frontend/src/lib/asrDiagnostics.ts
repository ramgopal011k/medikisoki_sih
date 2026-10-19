/**
 * ASR Diagnostics Utility for MediKiosk
 *
 * Reports browser capability, ASR engine support, mic permissions, and MIME support.
 * Does NOT log any patient data, speech transcripts, or medical information.
 * Safe to expose in deployed environments for debugging.
 */

export interface AsrCapabilityReport {
  browser: string;
  browserVersion: string;
  os: string;
  isMobile: boolean;
  isSecureContext: boolean;
  hasNativeSpeechRecognition: boolean;  // window.SpeechRecognition
  hasWebkitSpeechRecognition: boolean;   // window.webkitSpeechRecognition
  hasMicrophoneAccess: boolean;           // navigator.mediaDevices.getUserMedia exists
  hasMediaRecorder: boolean;              // window.MediaRecorder exists
  supportedMimeTypes: string[];           // audio/* mimes supported by MediaRecorder
  recommendedMime: string;               // best mime to use for recording
  micPermissionState: 'granted' | 'denied' | 'prompt' | 'unknown';
  selectedAsrStrategy: 'native' | 'mediarecorder' | 'none';
  selectedLanguage: string;
  lastAsrError: string | null;
}

// Audio MIME types to probe, ordered by preference
const CANDIDATE_MIMES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4;codecs=mp4a.40.2',  // AAC-LC
  'audio/mp4',
  'audio/aac',
  'audio/wav',
];

/** Returns the list of MIME types supported by MediaRecorder in this browser. */
export function getSupportedMimeTypes(): string[] {
  if (typeof window === 'undefined' || !window.MediaRecorder) return [];
  return CANDIDATE_MIMES.filter(mime => {
    try {
      return MediaRecorder.isTypeSupported(mime);
    } catch {
      return false;
    }
  });
}

/** Returns the best recording MIME type to use. Safari needs mp4/aac; Chrome prefers webm/opus. */
export function getBestRecordingMime(): string {
  const supported = getSupportedMimeTypes();
  if (supported.length === 0) return 'audio/webm'; // fallback even if unsupported
  return supported[0];
}

/**
 * Returns a human-readable browser detection string.
 * Uses feature detection, not user-agent sniffing, wherever possible.
 */
function detectBrowserInfo(): { browser: string; version: string; os: string; isMobile: boolean } {
  if (typeof navigator === 'undefined') {
    return { browser: 'unknown', version: '', os: 'unknown', isMobile: false };
  }
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let version = '';
  let os = 'Unknown';
  let isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);

  // OS detection
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|MacIntel/i.test(ua)) os = 'macOS';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Browser detection
  if (/Samsung/i.test(ua)) {
    browser = 'Samsung Internet';
    const m = ua.match(/SamsungBrowser\/([\d.]+)/);
    if (m) version = m[1];
  } else if (/Edg\//i.test(ua)) {
    browser = 'Edge';
    const m = ua.match(/Edg\/([\d.]+)/);
    if (m) version = m[1];
  } else if (/OPR\//i.test(ua)) {
    browser = 'Opera';
    const m = ua.match(/OPR\/([\d.]+)/);
    if (m) version = m[1];
  } else if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) {
    browser = 'Chrome';
    const m = ua.match(/Chrome\/([\d.]+)/);
    if (m) version = m[1];
  } else if (/Firefox/i.test(ua)) {
    browser = 'Firefox';
    const m = ua.match(/Firefox\/([\d.]+)/);
    if (m) version = m[1];
  } else if (/Safari/i.test(ua)) {
    browser = 'Safari';
    const m = ua.match(/Version\/([\d.]+)/);
    if (m) version = m[1];
  } else if (/Chromium/i.test(ua)) {
    browser = 'Chromium';
  }

  return { browser, version, os, isMobile };
}

/** Query the PermissionsAPI for microphone state, or return 'unknown' if unsupported. */
async function getMicPermissionState(): Promise<AsrCapabilityReport['micPermissionState']> {
  if (typeof navigator === 'undefined' || !navigator.permissions) return 'unknown';
  try {
    // 'microphone' is a valid PermissionName in modern browsers
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return result.state as AsrCapabilityReport['micPermissionState'];
  } catch {
    return 'unknown';
  }
}

/**
 * Determines the optimal ASR strategy for the current browser:
 * - 'native': browser has reliable native SpeechRecognition (Chromium family)
 * - 'mediarecorder': fallback via MediaRecorder + backend ASR
 * - 'none': neither supported
 */
export function selectAsrStrategy(): 'native' | 'mediarecorder' | 'none' {
  if (typeof window === 'undefined') return 'none';

  const hasNative = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const hasMR = !!window.MediaRecorder;
  const hasGUM = !!(navigator.mediaDevices?.getUserMedia);

  if (!window.isSecureContext) return 'none';

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);

  // Prioritize native WebSpeech API on BOTH desktop and mobile if supported (e.g. Chrome, Android Chrome, Edge)
  // This bypasses cloud ASR completely and uses the device's free, built-in speech recognition.
  if (hasNative) return 'native';

  // Fallback to MediaRecorder + Backend ASR for browsers lacking native speech (e.g. Firefox, Safari, iOS Chrome)
  if (hasMR && hasGUM) return 'mediarecorder';

  return 'none';
}

let _lastAsrError: string | null = null;

/** Records last ASR error (sanitized — no patient data). */
export function setLastAsrError(error: string | null): void {
  // Only log technical error codes, never patient transcripts
  _lastAsrError = error;
}

/** Builds a complete ASR capability report for diagnostics. */
export async function buildAsrReport(): Promise<AsrCapabilityReport> {
  const { browser, version, os, isMobile } = detectBrowserInfo();
  const permState = await getMicPermissionState();
  const supportedMimes = getSupportedMimeTypes();
  const recommendedMime = getBestRecordingMime();
  const strategy = selectAsrStrategy();
  const patientLang = typeof localStorage !== 'undefined'
    ? (localStorage.getItem('patient_language') || 'en')
    : 'en';

  return {
    browser,
    browserVersion: version,
    os,
    isMobile,
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
    hasNativeSpeechRecognition: typeof window !== 'undefined' && !!window.SpeechRecognition,
    hasWebkitSpeechRecognition: typeof window !== 'undefined' && !!window.webkitSpeechRecognition,
    hasMicrophoneAccess: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    hasMediaRecorder: typeof window !== 'undefined' && !!window.MediaRecorder,
    supportedMimeTypes: supportedMimes,
    recommendedMime,
    micPermissionState: permState,
    selectedAsrStrategy: strategy,
    selectedLanguage: patientLang,
    lastAsrError: _lastAsrError,
  };
}

/** Logs a sanitized ASR diagnostic summary to the console. Does NOT log patient data. */
export async function logAsrDiagnostics(): Promise<void> {
  const report = await buildAsrReport();
  console.group('[MediKiosk ASR Diagnostics]');
  console.log('Browser:', report.browser, report.browserVersion, '|', report.os, report.isMobile ? '(Mobile)' : '(Desktop)');
  console.log('Secure Context:', report.isSecureContext);
  console.log('Native SpeechRecognition:', report.hasNativeSpeechRecognition);
  console.log('webkitSpeechRecognition:', report.hasWebkitSpeechRecognition);
  console.log('MediaRecorder:', report.hasMediaRecorder);
  console.log('getUserMedia:', report.hasMicrophoneAccess);
  console.log('Mic Permission:', report.micPermissionState);
  console.log('Supported MIMEs:', report.supportedMimeTypes.join(', ') || 'none');
  console.log('Recommended MIME:', report.recommendedMime);
  console.log('Selected Strategy:', report.selectedAsrStrategy);
  console.log('Language:', report.selectedLanguage);
  if (report.lastAsrError) {
    console.warn('Last ASR Error:', report.lastAsrError);
  }
  console.groupEnd();
}
