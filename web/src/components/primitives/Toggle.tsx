interface Props {
  on: boolean;
  onChange: (on: boolean) => void;
}

export function Toggle({ on, onChange }: Props) {
  return <div className={`toggle ${on ? "on" : ""}`} onClick={() => onChange(!on)} />;
}
