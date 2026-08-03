import { useAuth } from "../AuthContext";

export function RecoveryCodeDisplay({ code }: { code: string }) {
  const { acknowledgeRecoveryCode } = useAuth();

  return (
    <div className="page auth-page">
      <div className="panel auth-panel">
        <h1>Save Your Recovery Code</h1>
        <p className="hint">
          If you ever forget your password, this code is the only way back into your account —
          there's no email recovery. Write it down or save it in a password manager now.
        </p>
        <p className="recovery-code">{code}</p>
        <p className="hint">You can generate a new one any time from the account menu, which will make this one stop working.</p>
        <button className="btn-primary" onClick={acknowledgeRecoveryCode}>I've saved it, continue</button>
      </div>
    </div>
  );
}
