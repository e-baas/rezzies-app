/**
 * Build environment flags.
 *
 * `EXPO_PUBLIC_ENV` is injected per EAS profile (see eas.json):
 *   • internal / testflight  -> "internal"   (beta builds, TestFlight)
 *   • production             -> "production" (App Store)
 *   • dev / preview          -> undefined    (Metro, simulator previews)
 *
 * The floating bug button must appear in every NON-production surface
 * (dev, simulator preview, internal, TestFlight beta) and NEVER in the
 * App Store production build. We treat "production" as the only opt-out
 * value, so an unset env (local dev / preview) correctly shows the button.
 */
const ENV = process.env.EXPO_PUBLIC_ENV;

/** True everywhere except the production App Store build. */
export const IS_BETA_BUILD: boolean = __DEV__ || ENV !== 'production';

/** True only in the shipped App Store production build. */
export const IS_PRODUCTION_BUILD: boolean = !__DEV__ && ENV === 'production';
