// JS binding for the local Android module. Absent in Expo Go / web (returns null).
import { requireOptionalNativeModule } from "expo";

type AuthResult = { accessToken: string | null; grantedScopes: string[] };
type NativeGoogleAuth = {
  authorize(interactive: boolean): Promise<AuthResult>;
  clearToken(token: string): Promise<null>;
};

export const SublyGoogleAuth = requireOptionalNativeModule<NativeGoogleAuth>("SublyGoogleAuth");
