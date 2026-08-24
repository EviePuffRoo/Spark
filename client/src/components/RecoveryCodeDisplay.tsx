import { useAuth } from "../AuthContext";
import { CopyButton } from "./CopyButton";

export function RecoveryCodeDisplay({ code }: { code: string }) {
  const { acknowledgeRecoveryCode } = useAuth();

  return (
    <div className="page auth-page">
      <div className="panel auth-panel">
        <h1>Save Your Recovery Code</h1>
        <p className="hint">
          If you ever forget your password, this code is the only way back into your account.
          There's no email recovery. Write it down or save it in a password manager now.
        </p>
        <div className="recovery-code-row">
          <p className="recovery-code">{code}</p>
          <CopyButton value={code} />
        </div>
        <p className="hint">You can generate a new one any time from your Profile settings, which will make this one stop working.</p>
        <button className="btn-primary" onClick={acknowledgeRecoveryCode}>I've saved it, continue</button>
      </div>
    </div>
  );
}
