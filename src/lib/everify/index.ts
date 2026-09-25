import { ManualEVerifyProvider } from './manualProvider';
import type { EVerifyProvider } from './types';

export type { EVerifyProvider, EVerifyCaseInput, EVerifyCaseStatus } from './types';

export function getEVerifyProvider(): EVerifyProvider {
  return new ManualEVerifyProvider();
}
